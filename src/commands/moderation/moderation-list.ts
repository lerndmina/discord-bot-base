import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import Database from "../../utils/data/database";
import ModeratedChannel, { ModerationCategory } from "../../models/ModeratedChannels";
import log from "../../utils/log";
import { CommandOptions, SlashCommandProps } from "commandkit";
import { initialReply } from "../../utils/initialReply";

export const data = new SlashCommandBuilder()
  .setName("moderation-list")
  .setDescription("List all channels with moderation enabled in this guild")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
  userPermissions: ["ManageMessages"],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  await initialReply(interaction, true);

  try {
    const { guild } = interaction;

    if (!guild) {
      return interaction.editReply("This command can only be used in a server.");
    }

    const db = new Database();
    const moderatedChannels = await db.find(ModeratedChannel, { guildId: guild.id }, true);

    if (!moderatedChannels || !moderatedChannels.length) {
      return interaction.editReply("No channels with moderation enabled found in this server.");
    }

    // Group channels by modlog
    const channelGroups: Record<
      string,
      {
        channels: string[];
        categories: string[];
      }
    > = {};

    // Get all available moderation categories
    const allCategories = Object.values(ModerationCategory);

    // Populate channel groups
    for (const channel of moderatedChannels) {
      const modlogKey = channel.modlogChannelId || "no-modlog";
      if (!channelGroups[modlogKey]) {
        channelGroups[modlogKey] = {
          channels: [],
          categories: [],
        };
      }

      // Add channel to group
      channelGroups[modlogKey].channels.push(channel.channelId);

      // Store categories if they're not the default (all categories)
      if (
        channel.moderationCategories &&
        channel.moderationCategories.length < allCategories.length
      ) {
        channelGroups[modlogKey].categories = channel.moderationCategories;
      }
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle("Moderation Enabled Channels")
      .setColor("#5865F2")
      .setDescription(
        `Found ${moderatedChannels.length} channel(s) with moderation enabled in this server.`
      )
      .setTimestamp();

    // Add fields for each modlog group
    for (const [modlogId, group] of Object.entries(channelGroups)) {
      const modlogName = modlogId === "no-modlog" ? "*No modlog channel set*" : `<#${modlogId}>`;

      const channelsList = group.channels.map((channelId) => `<#${channelId}>`).join(", ");

      let fieldValue = channelsList;

      // Add categories info if specific categories are set
      if (group.categories.length > 0) {
        fieldValue += `\n**Categories:** ${group.categories.join(", ")}`;
      }

      // Add image moderation info
      if (group.channels.length === 1) {
        const channel = moderatedChannels.find((c) => c.channelId === group.channels[0]);
        if (channel && channel.moderateImages === false) {
          fieldValue += "\n*Image moderation disabled*";
        }
      }

      embed.addFields({
        name: `📋 Reporting to ${modlogName}`,
        value: fieldValue,
      });
    }

    return interaction.editReply({ embeds: [embed], content: null });
  } catch (error) {
    log.error("Error in moderation-list command:", error);
    return interaction.editReply("An error occurred while fetching moderated channels.");
  }
}
