import { ChannelType, Client, EmbedBuilder, Message, TextChannel } from "discord.js";
import log from "../utils/log";
import { ModerationCategory } from "../models/ModeratedChannels";
import ModeratedChannel from "../models/ModeratedChannels";
import { processModerationResult, formatCategoryName } from "../utils/moderationUtils";
import OpenAI from "openai";
import FetchEnvs from "../utils/FetchEnvs";
import Database from "../utils/data/database";
import { getDiscordDate, TimeType } from "../utils/TinyUtils";
const openai = new OpenAI();
const env = FetchEnvs();
const db = new Database();

export default async (message: Message, client: Client<true>) => {
  // Skip if from a bot or in DMs
  if (message.author.bot || message.channel.type === ChannelType.DM) return;

  if (!message.guild) return;

  try {
    // Check if channel is configured for moderation
    const channelConfig = await db.findOne(
      ModeratedChannel,
      { channelId: message.channel.id, guildId: message.guild.id },
      true
    );
    if (!channelConfig) return;

    // Skip if empty message (likely just an attachment)
    if (!message.content.trim()) return;

    // Call OpenAI moderation API
    const response = await openai.moderations.create({
      input: message.content,
    });

    // Process moderation result
    const result = processModerationResult(
      response,
      channelConfig.moderationCategories as ModerationCategory[]
    );

    // If content is flagged, take action
    if (result.flagged) {
      log.info(`Message flagged by AI moderation in #${message.channel.name}: ${message.content}`);

      try {
        // Format the flagged categories for the warning
        const flaggedCategories = Object.entries(result.categories)
          .filter(([_, isFlagged]) => isFlagged)
          .map(([category]) => formatCategoryName(category as ModerationCategory));

        // Send to the modlog channel if configured
        if (channelConfig.modlogChannelId) {
          const modlogChannel = client.channels.cache.get(
            channelConfig.modlogChannelId
          ) as TextChannel;

          if (modlogChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🚨 Content flagged")
              .setColor("#FFA500")
              .addFields(
                {
                  name: "User",
                  value:
                    `**User:** ${message.author} (${message.author.tag})\n` +
                    `**ID:** ${message.author.id}\n` +
                    `**User Created:** ${getDiscordDate(
                      message.author.createdAt,
                      TimeType.DATE
                    )} ${getDiscordDate(message.author.createdAt, TimeType.RELATIVE)}\n` +
                    `**User Joined:** ${getDiscordDate(
                      message.member?.joinedAt!,
                      TimeType.DATE
                    )} ${getDiscordDate(message.member?.joinedAt!, TimeType.RELATIVE)}\n`,
                  inline: false,
                },
                {
                  name: "Reason(s)",
                  value: flaggedCategories.join(", ") || "Flagged content",
                  inline: false,
                },
                {
                  name: "Highlighted message(s)",
                  value:
                    message.content.length > 256
                      ? `${message.content.substring(0, 253)}...`
                      : message.content || "No text content",
                  inline: false,
                }
              )
              .setTimestamp();

            // Add message link as footer
            logEmbed.setFooter({
              text: `Message sent in #${message.channel.name}`,
              iconURL: message.guild.iconURL() || undefined,
            });

            // Add optional thumbnail from user avatar
            logEmbed.setThumbnail(message.author.displayAvatarURL());

            // Create action buttons
            await modlogChannel.send({
              embeds: [logEmbed],
              components: [
                {
                  type: 1, // Action Row
                  components: [
                    {
                      type: 2, // Button
                      style: 3, // Success (green)
                      label: "Accept (Report valid)",
                      custom_id: `mod_accept:${message.id}:${message.channelId}:${message.author.id}`,
                    },
                    {
                      type: 2, // Button
                      style: 4, // Danger (red)
                      label: "Ignore (Report invalid)",
                      custom_id: `mod_ignore:${message.id}`,
                    },
                  ],
                },
                {
                  type: 1, // Action Row
                  components: [
                    {
                      type: 2, // Button
                      style: 2, // Secondary (grey)
                      label: "Delete Message",
                      custom_id: `mod_delete:${message.id}:${message.channelId}`,
                    },
                    {
                      type: 2, // Button
                      style: 2, // Secondary (grey)
                      label: "Warn User",
                      custom_id: `mod_warn:${message.author.id}`,
                    },
                    {
                      type: 2, // Button
                      style: 2, // Secondary (grey)
                      label: "Timeout User",
                      custom_id: `mod_timeout:${message.author.id}`,
                    },
                    {
                      type: 2, // Button
                      style: 2, // Secondary (grey)
                      label: "View Details",
                      custom_id: `mod_details:${message.id}:${message.channelId}`,
                    },
                  ],
                },
              ],
            });
          }
        } else {
          log.warn(`Message flagged but no modlog channel set for ${message.guild.name}`);
        }
      } catch (error) {
        log.error("Error handling flagged message:", error);
      }
    }
  } catch (error) {
    log.error("Error in AI moderation:", error);
  }
};
