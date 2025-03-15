import {
  ApplicationCommandSubCommand,
  CacheType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import { ChannelType } from "discord.js";
import { Channel } from "diagnostics_channel";

import GuildNewVC from "../../models/GuildNewVC";
import { ThingGetter } from "../../utils/TinyUtils";
import { CommandData, CommandOptions, CommandProps, SlashCommandProps } from "commandkit";
import log from "../../utils/log";

export const data = new SlashCommandBuilder()
  .setName("tempvc")
  .setDescription("Create or delete a temporary voice channel for this guild.")
  .setDMPermission(false)
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("create")
      .setDescription("Create a temporary voice channel for this guild.")
      .addChannelOption((option) =>
        option.setName("channel").setDescription("The channel you want to use").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("category")
          .setDescription("What category to put the temp VCs in.")
          .setRequired(true)
          .setMinLength(17)
      );
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("delete")
      .setDescription("Delete the temporary voice channel for this guild.")
      .addChannelOption((option) =>
        option.setName("channel").setDescription("The users join.").setRequired(true)
      );
  });

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const i = interaction as ChatInputCommandInteraction;
  const getter = new ThingGetter(client);
  const subcommand = i.options.getSubcommand();

  if (!subcommand) return log.error("We got a command interaction without a subcommand.");
  if (!i.guild) return log.error("We got a guildOnly command interaction without a guild.");

  const member = await getter.getMember(i.guild, i.user.id);
  if (!member) return interaction.reply({ content: "You are not in this guild.", ephemeral: true });
  if (!member.permissions.has("ManageGuild"))
    return i.reply({ content: "You do not have permission to use this command.", ephemeral: true });

  const query = {
    guildID: i.guild!.id, // This is a guild only command clientside so we can assume a guild exists
  };

  if (subcommand === "create") {
    var channel = i.options.getChannel("channel");
    if (!channel) return log.error("Channel is missing on a required command option.");

    const category = i.options.getString("category") as string;

    // Check if the category exists
    const categoryChannel = await getter.getChannel(category);
    if (!categoryChannel) {
      await i.reply({
        content: `The category ${category} does not exist.`,
        ephemeral: true,
      });
      return;
    }

    const channelName = "name" in categoryChannel ? categoryChannel.name : "`Name Missing`";

    if (categoryChannel.type !== ChannelType.GuildCategory) {
      await i.reply({
        content: `The channel \`${channelName}\` is not a category.`,
        ephemeral: true,
      });
      return;
    }

    // Check if the channel is a voice channel
    if (channel.type !== ChannelType.GuildVoice) {
      await i.reply({
        content: `The channel \`${channelName}\` is not a voice channel.`,
        ephemeral: true,
      });

      return;
    }

    await i.reply({
      embeds: [
        BasicEmbed(client, "Creating...", `Creating temp vc under \`${categoryChannel.name}.`),
      ],
    });

    try {
      const vcList = await GuildNewVC.findOne(query);

      if (vcList) {
        vcList.guildChannelIDs.push({
          channelID: channel.id,
          categoryID: category,
        });
        await vcList.save();
      } else {
        const newVCList = new GuildNewVC({
          guildID: i.guild.id,
          guildChannelIDs: [
            {
              channelID: channel.id,
              categoryID: category,
            },
          ],
        });
        await newVCList.save();
      }

      await i.editReply({
        embeds: [
          BasicEmbed(
            client,
            "Success!",
            `Assigned \`${channel.name}.\` to a temp vc under \`${categoryChannel.name}\`.`,
            undefined,
            "#0099ff"
          ),
        ],
      });
    } catch (error) {
      log.info(`Error creating temp vc creator: \`\`\`${error}\`\`\``);

      await i.editReply({
        embeds: [
          BasicEmbed(
            client,
            "Error!",
            `Error creating temp vc creator: \`\`\`${error}\`\`\``,
            undefined,
            "#0099ff"
          ),
        ],
      });
    }
  } else if (subcommand === "delete") {
    // Check if channel is in the DB then delete the entry for it
    var channel = i.options.getChannel("channel");
    if (!channel) return log.error("Channel is missing on a required command option.");

    const vcList = await GuildNewVC.findOne(query);

    if (!vcList) {
      await i.reply({
        content: `There are no temp VCs for this guild.`,
        ephemeral: true,
      });
      return;
    }

    const vc = vcList.guildChannelIDs.find((vc) => vc.channelID === channel!.id);

    if (!vc) {
      await i.reply({
        content: `The channel \`${channel.name}\` is not a temp VC.`,
        ephemeral: true,
      });
      return;
    }

    await i.reply({
      embeds: [BasicEmbed(client, "Deleting...", `Deleting temp vc creator \`${channel.name}.\``)],
    });

    try {
      vcList.guildChannelIDs = vcList.guildChannelIDs.filter((vc) => vc.channelID !== channel!.id);
      await vcList.save();

      await i.editReply({
        embeds: [
          BasicEmbed(
            client,
            "Success!",
            `Deleted temp vc creator \`${channel.name}\`.`,
            undefined,
            "#0099ff"
          ),
        ],
      });
    } catch (error) {
      log.info(`Error deleting temp vc creator:`);
      log.info(error as string);

      await i.editReply({
        embeds: [
          BasicEmbed(
            client,
            "Error!",
            `Error deleting temp vc creator: \`\`\`${error}\`\`\``,
            undefined,
            "#0099ff"
          ),
        ],
      });
    }
  }
}
