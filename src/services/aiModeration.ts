import { ChannelType, Client, Message, TextChannel } from "discord.js";
import log from "../utils/log";
import { ModerationCategory } from "../models/ModeratedChannels";
import ModeratedChannel from "../models/ModeratedChannels";
import { processModerationResult } from "../utils/moderationUtils";
import OpenAI from "openai";
import FetchEnvs from "../utils/FetchEnvs";
import Database from "../utils/data/database";
import { moderationEmbeds } from "./moderationEmbeds";
const openai = new OpenAI();
const env = FetchEnvs();
const db = new Database();

// Function to check if URL is an image
function isImageUrl(url: string): boolean {
  try {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"];
    // Handle URLs with query parameters or fragments
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    return imageExtensions.some((ext) => path.endsWith(ext));
  } catch (error) {
    // If URL parsing fails, try simpler approach
    const lowerUrl = url.toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"];
    return imageExtensions.some((ext) => lowerUrl.includes(ext));
  }
}

// Function to check if URL is a Tenor GIF
function isTenorUrl(url: string): boolean {
  return url.toLowerCase().includes("tenor.com");
}

// Function to extract text content for moderation
function extractTextContent(message: Message): string {
  return message.content.trim();
}

// Function to extract image URLs from message
function extractImageUrls(message: Message): string[] {
  const imageUrls: string[] = [];

  // Get image attachments
  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      imageUrls.push(attachment.url);
    }
  }

  // Extract image URLs from message content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.content.match(urlRegex);

  if (urls) {
    for (const url of urls) {
      try {
        if (isImageUrl(url) || isTenorUrl(url)) {
          // For added safety, try to construct a valid URL object
          new URL(url); // This will throw if the URL is invalid
          imageUrls.push(url);
          log.debug(`Detected image URL: ${url}`);
        }
      } catch (error) {
        log.warn(`Invalid URL detected in message: ${url}`);
      }
    }
  }

  return imageUrls;
}

export default async (message: Message, client: Client<true>) => {
  // Skip if from a bot or in DMs
  if (message.author.bot || message.channel.type === ChannelType.DM) return;

  if (!message.guild) return;

  try {
    log.info(
      `Checking moderation for message in #${message.channel.name} (${message.guild.name}) from ${message.author.tag}`
    );

    // First check if channel is configured for moderation
    let channelConfig = await db.findOne(
      ModeratedChannel,
      { channelId: message.channel.id, guildId: message.guild.id },
      true
    );

    if (channelConfig) {
      log.info(
        `Found channel-specific moderation config for #${message.channel.name}: enabled=${
          channelConfig.isEnabled
        }, modlogChannel=${channelConfig.modlogChannelId || "none"}`
      );
    } else {
      log.info(
        `No channel-specific moderation found for #${message.channel.name}, checking guild defaults...`
      );

      // If no channel-specific config exists, try to find guild-wide default settings
      const guildDefaultConfig = await db.findOne(
        ModeratedChannel,
        { guildId: message.guild.id, isGuildDefault: true },
        true
      );

      if (guildDefaultConfig) {
        log.info(
          `Found guild default moderation settings: enabled=${
            guildDefaultConfig.isEnabled
          }, modlogChannel=${guildDefaultConfig.modlogChannelId || "none"}`
        );
        channelConfig = guildDefaultConfig;
      } else {
        log.info(`No guild default moderation settings found for guild ${message.guild.name}`);
        return;
      }
    }

    // Skip if moderation is disabled for this channel or at the guild level
    if (!channelConfig.isEnabled) {
      log.info(`Moderation is disabled for this channel/guild, skipping`);
      return;
    }

    // Extract text and image URLs
    const textContent = extractTextContent(message);
    const imageUrls = extractImageUrls(message);

    // Skip if no content to moderate
    if (!textContent && imageUrls.length === 0) {
      log.info(`No content to moderate in message, skipping`);
      return;
    }

    log.info(
      `Content to moderate: text=${!!textContent}, images=${
        imageUrls.length > 0 ? imageUrls.length : 0
      }`
    );

    // Track if content is flagged and what type
    let isContentFlagged = false;
    let flaggedCategories: ModerationCategory[] = [];
    const contentTypes: string[] = [];
    // Track confidence scores for each flagged category
    const confidenceScores: Record<string, number> = {};

    // Moderate text content if exists
    if (textContent) {
      contentTypes.push("text");
      log.debug(
        `Moderating text in ${message.channel.name}: ${textContent.substring(0, 50)}${
          textContent.length > 50 ? "..." : ""
        }`
      );

      try {
        const textResponse = await openai.moderations.create({
          input: textContent,
        });

        const textResult = processModerationResult(
          textResponse,
          channelConfig.moderationCategories as ModerationCategory[]
        );

        if (textResult.flagged) {
          isContentFlagged = true;

          // Add flagged categories and store their confidence scores
          Object.entries(textResult.categories)
            .filter(([_, isFlagged]) => isFlagged)
            .forEach(([category]) => {
              if (!flaggedCategories.includes(category as ModerationCategory)) {
                flaggedCategories.push(category as ModerationCategory);

                // Store the confidence score if available
                const categoryScores = textResponse.results[0]?.category_scores;
                if (categoryScores && categoryScores[category]) {
                  confidenceScores[category] = categoryScores[category];
                }
              }
            });
        }
      } catch (error) {
        log.error("Error in text moderation:", error);
      }
    }

    // Moderate images if exist
    if (imageUrls.length > 0) {
      contentTypes.push("images");
      log.debug(`Moderating ${imageUrls.length} images in ${message.channel.name}`);

      // Dump the current moderateImages setting for debugging
      log.info(
        `Image moderation setting: ${JSON.stringify({
          channelId: message.channel.id,
          isGuildDefault: channelConfig.isGuildDefault || false,
          moderateImages: channelConfig.moderateImages,
          configSource: channelConfig.isGuildDefault ? "guild-default" : "channel-specific",
        })}`
      );

      // Currently, OpenAI moderation API doesn't support image moderation directly
      // Flag messages with images for manual review
      if (channelConfig.moderateImages === true) {
        log.info(`Image moderation is enabled, flagging message`);
        isContentFlagged = true;
        flaggedCategories.push("other" as ModerationCategory);
      } else {
        log.info(`Image moderation is disabled, not flagging message`);
      }
    }

    // If any content is flagged, take action
    if (isContentFlagged) {
      log.info(
        `Message flagged by moderation in #${
          message.channel.name
        }, categories: ${flaggedCategories.join(", ")}`
      );

      try {
        // Send to the modlog channel if configured
        if (channelConfig.modlogChannelId) {
          const modlogChannel = client.channels.cache.get(
            channelConfig.modlogChannelId
          ) as TextChannel;

          if (modlogChannel) {
            // Create the report embed using the service, now including confidence scores
            const logEmbed = moderationEmbeds.createReportEmbed(
              message,
              flaggedCategories,
              contentTypes,
              confidenceScores
            );

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
    } else {
      log.info(`Message not flagged by moderation`);
    }
  } catch (error) {
    log.error("Error in AI moderation:", error);
  }
};
