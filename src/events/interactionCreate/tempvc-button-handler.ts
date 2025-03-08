import {
  BaseInteraction,
  Client,
  InteractionType,
  User,
  Channel,
  ChannelType,
  PermissionFlagsBits,
  ComponentType,
  ButtonStyle,
  ButtonInteraction,
  MessageComponentInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildChannel,
  ModalSubmitInteraction,
  BaseGuildVoiceChannel,
  Invite,
  UserSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import ms from "ms";
import log from "../../utils/log";

const interactionBanUser = "tempvc-ban-user-menu";
const interactionPostBanMenu = "tempvc-ban";
const interactionLimitUsers = "tempvc-limit";
const interactionSendInvite = "tempvc-invite";
const interactionRenameVC = "tempvc-rename";
const interactionDeleteVC_NO = "tempvc-delete-no";
const interactionDeleteVC_YES = "tempvc-delete-yes";
const interactionDeleteVC_REQUEST = "tempvc-delete";

export default async (interaction: MessageComponentInteraction, client: Client<true>) => {
  if (interaction.type != InteractionType.MessageComponent) return;
  if (!interaction.channel || interaction.channel.type != ChannelType.GuildVoice) return;
  if (!interaction.guild) return;

  // log.info(`Interaction with custom id ${interaction.customId} received.`);
  if (
    !interaction.channel
      .permissionsFor(interaction.user)
      ?.has(PermissionFlagsBits.ManageChannels) &&
    interaction.customId.startsWith("tempvc-")
  ) {
    interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Error!",
          `You do not have permission to use this button. You need the \`Manage Channels\` permission.`
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel;
  const user = interaction.user;
  try {
    if (interaction.customId.startsWith(interactionDeleteVC_REQUEST)) {
      DeleteChannelButtons(interaction, channel, user);
    } else if (interaction.customId.startsWith(interactionDeleteVC_YES)) {
      /**
       * Kick all members from the channel, we delete it somewhere else
       * @file /src/events/voiceStatUpdate/leftTempVC.js
       */
      channel.members.forEach((member) => {
        member.voice.setChannel(null);
      });
    } else if (interaction.customId.startsWith(interactionDeleteVC_NO)) {
      interaction.message.delete();
    } else if (interaction.customId.startsWith(interactionRenameVC)) {
      RenameVCModal(interaction, channel, user);
    } else if (interaction.customId.startsWith(interactionSendInvite)) {
      SendInvite(interaction, channel, user);
    } else if (interaction.customId.startsWith(interactionPostBanMenu)) {
      PostBanUserDropdown(interaction, channel, user);
    } else if (interaction.customId.startsWith(interactionBanUser)) {
      BanUserFromChannel(interaction as StringSelectMenuInteraction, channel, user);
    } else if (interaction.customId.startsWith(interactionLimitUsers)) {
      LimitUsers(interaction, channel, user);
    }
  } catch (error) {
    log.error(`Error handling interaction: ${error}`);
  }
};

function DeleteChannelButtons(
  interaction: MessageComponentInteraction,
  channel: Channel,
  user: User
) {
  // Ask for confirmation ephemeral message
  interaction.reply({
    content: `Are you sure you want to delete this channel?`,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: "Yes",
            customId: "tempvc-delete-yes",
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: "No",
            customId: "tempvc-delete-no",
          },
        ],
      },
    ],
  });
  return true; // Stops the event loop.
}

async function RenameVCModal(
  interaction: MessageComponentInteraction,
  channel: GuildChannel,
  user: User
) {
  const modalId = "tempvc-rename-modal";

  const modal = new ModalBuilder().setCustomId(modalId).setTitle("Rename your channel");

  const nameInput = new TextInputBuilder()
    .setCustomId("tempvc-name-input")
    .setLabel("Enter the new name")
    .setMinLength(1)
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("My Channel");

  const actionRow = new ActionRowBuilder().addComponents(nameInput);

  modal.addComponents(actionRow as any);

  await interaction.showModal(modal);

  const interactionFilter = (interaction: ModalSubmitInteraction) =>
    interaction.customId === modalId;

  interaction
    .awaitModalSubmit({ filter: interactionFilter, time: 120000 })
    .then(async (modalInteraction) => {
      const nameValue = modalInteraction.fields.getTextInputValue("tempvc-name-input");

      await channel.setName(nameValue);

      await modalInteraction.reply({
        embeds: [
          BasicEmbed(
            interaction.client,
            `Renamed!`,
            `You renamed this channel to \`${nameValue}\``
          ),
        ],
        ephemeral: true,
      });
    });
  return true; // Stops the event loop.
}

async function SendInvite(
  interaction: MessageComponentInteraction,
  channel: BaseGuildVoiceChannel,
  user: User
) {
  const tenMinutes = ms("10m") / 1000;
  const expiresAt = Math.floor(Date.now() / 1000 + tenMinutes);

  let invite = (await channel
    .createInvite({
      maxAge: tenMinutes, // discord uses seconds
      maxUses: 10,
    })
    .catch((err) => {
      interaction.reply({
        embeds: [
          BasicEmbed(
            interaction.client,
            "Error!",
            `Error creating invite: \`\`\`${err}\`\`\``,
            undefined,
            "Red"
          ),
        ],
      });
      return true;
    })) as Invite;

  interaction.reply({
    embeds: [
      BasicEmbed(
        interaction.client,
        "Invite Created!",
        `Here is your invite: ${invite.url} \n Share it with your friends!`,
        [
          {
            name: "Invite Expires",
            value: `<t:${expiresAt}:R>`,
            inline: true,
          },
          { name: "Invite Max Uses", value: `\`${invite.maxUses}\``, inline: true },
        ]
      ),
    ],
  });
  interaction.channel!.send({ content: `${invite.url}` });

  return true; // Stops the event loop.
}

async function PostBanUserDropdown(
  interaction: MessageComponentInteraction,
  channel: BaseGuildVoiceChannel,
  user: User
) {
  if (channel.isDMBased() || !channel.members) return;
  const members = channel.members;

  const userMenu = new UserSelectMenuBuilder()
    .setCustomId(interactionBanUser)
    .setPlaceholder("Select a user to ban")
    .setMinValues(1)
    .setMaxValues(5);

  const row1 = new ActionRowBuilder().addComponents(userMenu);

  await interaction.reply({
    embeds: [
      BasicEmbed(interaction.client, "Ban a user", `Select a user to ban from this channel.`),
    ],
    components: [row1 as any],
    ephemeral: true,
  });
}

function BanUserFromChannel(
  interaction: StringSelectMenuInteraction,
  channel: BaseGuildVoiceChannel,
  user: User
) {
  var count = 0;
  const users = interaction.values;
  users.forEach((userId) => {
    // Check if the user is not the interaction user
    if (userId == user.id) return;

    const member = channel.guild.members.cache.get(userId);
    if (!member) return;
    // Check if the user is in the channel
    if (member.voice.channelId == channel.id) member.voice.setChannel(null);

    // Set channel permissions to deny the user from joining
    channel.permissionOverwrites.edit(member, {
      Connect: false,
    });
    count++;
  });

  interaction.reply({
    embeds: [BasicEmbed(interaction.client, "Banned!", `Banned ${count} users from this channel.`)],
    ephemeral: true,
  });
}

function LimitUsers(
  interaction: MessageComponentInteraction,
  channel: BaseGuildVoiceChannel,
  user: User
) {
  const modalId = "tempvc-limit-modal";

  const modal = new ModalBuilder().setCustomId(modalId).setTitle("Limit your max users");

  const limitInput = new TextInputBuilder()
    .setCustomId("tempvc-limit-input")
    .setLabel("Enter the new limit")
    .setMinLength(1)
    .setMaxLength(2)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("1");

  const actionRow = new ActionRowBuilder().addComponents(limitInput);

  modal.addComponents(actionRow as any);

  interaction.showModal(modal);

  const interactionFilter = (interaction: ModalSubmitInteraction) =>
    interaction.customId === modalId;

  interaction
    .awaitModalSubmit({ filter: interactionFilter, time: 120000 })
    .then(async (modalInteraction) => {
      const limitValueStr = modalInteraction.fields.getTextInputValue("tempvc-limit-input");
      const limitValue = parseInt(limitValueStr);

      // Check if the limit is a number
      if (isNaN(limitValue)) {
        modalInteraction.reply({
          embeds: [
            BasicEmbed(
              interaction.client,
              "Error!",
              `The limit value must be a number!`,
              undefined,
              "Red"
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (limitValue <= 0) {
        modalInteraction.reply({
          embeds: [
            BasicEmbed(
              interaction.client,
              "Error!",
              `The limit value must be greater than \`0\`!`,
              undefined,
              "Red"
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        await channel.setUserLimit(limitValue);
      } catch (error) {
        modalInteraction.reply({
          embeds: [
            BasicEmbed(
              interaction.client,
              "Error!",
              `There was an error setting the limit: \`\`\`${error}\`\`\``,
              undefined,
              "Red"
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await modalInteraction.reply({
        embeds: [
          BasicEmbed(
            interaction.client,
            `Limit Set!`,
            `You set the user limit of this channel to \`${limitValue}\``
          ),
        ],
        ephemeral: true,
      });
    });
}
