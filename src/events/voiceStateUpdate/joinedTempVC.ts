import {
  Client,
  ChannelType,
  PermissionsBitField,
  VoiceState,
  VoiceChannel,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { GuildNewVC } from "../../models/GuildNewVC";
import ActiveTempChannels from "../../models/ActiveTempChannels";
import BasicEmbed from "../../utils/BasicEmbed";
import ButtonWrapper from "../../utils/ButtonWrapper";
import ms from "ms";
import log from "../../utils/log";
import Database from "../../utils/data/database";
import { redisClient } from "../../Bot";
import { tryCatch } from "../../utils/trycatch";

/**
 *
 * @param {any} oldState
 * @param {any} newState
 * @param {Client} client
 * @returns
 */

export default async (oldState: VoiceState, newState: VoiceState, client: Client<true>) => {
  if (newState.channelId == null) return;
  const db = new Database();
  const joinedChannelId = newState.channelId;
  const guildId = newState.guild.id;

  const vcList = await db.findOne(GuildNewVC, { guildID: guildId }, true);

  if (!vcList) return;

  const vc = vcList.guildChannelIDs.find((vc) => vc.channelID === joinedChannelId);

  if (!vc) return;

  const category = newState.guild.channels.cache.get(vc.categoryID!);

  if (!category) return;

  const joinedChannel = newState.guild.channels.cache.get(joinedChannelId) as VoiceChannel;

  if (!joinedChannel) return;
  const maxUsers = joinedChannel.userLimit;
  const bitrate = joinedChannel.bitrate;

  if (!newState.member) return;

  const channelNumber = await fetchChannelNumber(category.id);

  const newChannelName = vc.useSequentialNames
    ? `${vc.channelName} #${channelNumber}`
    : `- ${newState.member.displayName}'s VC`;

  try {
    var newChannel = await newState.guild.channels.create({
      name: newChannelName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: newState.member.id,
          allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
        },
      ],
      userLimit: maxUsers,
      bitrate: bitrate,
    });

    const { data: _, error: channelMoveError } = await tryCatch(newState.setChannel(newChannel));

    if (channelMoveError) {
      log.error(`Failed to move user to new channel, they probably left.. Too fast for me lol`);
      log.error(channelMoveError);
      await newChannel.delete("Failed to move user to new channel.");
      return;
    }

    setChannelNumberCache(category.id, channelNumber + 1);

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`tempvc-delete-${newChannel.id}`)
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️"),
      new ButtonBuilder()
        .setCustomId(`tempvc-rename-${newChannel.id}`)
        .setLabel("Rename")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId(`tempvc-invite-${newChannel.id}`)
        .setLabel("Invite")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📨"),
      new ButtonBuilder()
        .setCustomId(`tempvc-ban-${newChannel.id}`)
        .setLabel("Ban")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔨"),
      new ButtonBuilder()
        .setCustomId(`tempvc-limit-${newChannel.id}`)
        .setLabel("Limit")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔢"),
    ];

    newChannel.send({
      content: `<@${newState.id}>`,
      embeds: [
        BasicEmbed(
          client,
          "Hello! 👋",
          `Welcome to your new channel! \n You can change the channel name and permissions by clicking the settings icon next to the channel name. \n Once the channel is empty, it will be deleted automatically.`,
          [
            {
              name: "Control Menu",
              value: "Please use the buttons below to control the channel you have created.",
              inline: false,
            },
          ]
        ),
      ],
      components: ButtonWrapper(buttons),
    });

    const db = new Database();
    await db.addToSet(ActiveTempChannels, { guildID: guildId }, "channelIDs", newChannel.id);
  } catch (error) {
    log.error(error as string);
  }
};

export function getChannelNumberCacheKey(categoryId: string) {
  return `tempvc-${categoryId}-channelNum`;
}

export async function fetchChannelNumber(categoryId: string) {
  const number = await redisClient.get(getChannelNumberCacheKey(categoryId));

  if (!number || isNaN(parseInt(number))) {
    return 1;
  }

  return parseInt(number);
}

export async function setChannelNumberCache(categoryId: string, channelNumber?: number) {
  const currentChannelNumber = channelNumber ? channelNumber : await fetchChannelNumber(categoryId);
  return redisClient.set(getChannelNumberCacheKey(categoryId), currentChannelNumber.toString());
}
