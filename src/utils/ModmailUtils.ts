import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ThreadChannel,
  User,
  ButtonBuilder,
} from "discord.js";
import { ModmailType } from "../models/Modmail";
import { ThingGetter } from "./TinyUtils";
import log from "./log";
import FetchEnvs, { envExists } from "./FetchEnvs";
import BasicEmbed from "./BasicEmbed";

const env = FetchEnvs();

/**
 * Send a message to both the user's DMs and the modmail thread
 */
export async function sendMessageToBothChannels(
  client: Client<true>,
  modmail: ModmailType,
  embed: EmbedBuilder,
  content: string = "",
  options?: {
    dmComponents?: ActionRowBuilder<ButtonBuilder>[];
    threadComponents?: ActionRowBuilder<ButtonBuilder>[];
    /** @deprecated Use dmComponents and threadComponents instead */
    components?: ActionRowBuilder<ButtonBuilder>[];
  }
): Promise<{ dmSuccess: boolean; threadSuccess: boolean }> {
  const getter = new ThingGetter(client);
  let dmSuccess = false;
  let threadSuccess = false;

  // Handle backward compatibility
  const dmComponents = options?.dmComponents || options?.components || [];
  const threadComponents = options?.threadComponents || options?.components || [];

  // Send to user DMs
  try {
    const user = await getter.getUser(modmail.userId);
    if (user) {
      await user.send({
        content,
        embeds: [embed],
        components: dmComponents,
      });
      dmSuccess = true;
      log.debug(`Successfully sent modmail message to user ${modmail.userId} via DM`);
    }
  } catch (error) {
    log.warn(`Failed to send modmail message to user ${modmail.userId} via DM:`, error);
  }

  // Send to modmail thread
  try {
    const thread = (await getter.getChannel(modmail.forumThreadId)) as ThreadChannel;
    if (thread) {
      await thread.send({
        content,
        embeds: [embed],
        components: threadComponents,
      });
      threadSuccess = true;
      log.debug(`Successfully sent modmail message to thread ${modmail.forumThreadId}`);
    }
  } catch (error) {
    log.warn(`Failed to send modmail message to thread ${modmail.forumThreadId}:`, error);
  }

  return { dmSuccess, threadSuccess };
}

/**
 * Create disabled resolve buttons
 */
export function createDisabledResolveButtons(): ActionRowBuilder<ButtonBuilder> {
  const { ButtonStyle } = require("discord.js");

  const closeButton = new ButtonBuilder()
    .setCustomId("modmail_resolve_close_disabled")
    .setLabel("Close Thread")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✅")
    .setDisabled(true);

  const continueButton = new ButtonBuilder()
    .setCustomId("modmail_resolve_continue_disabled")
    .setLabel("I Need More Help")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🆘")
    .setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton, continueButton);
  return row;
}

/**
 * Create a close thread button component
 */
export function createCloseThreadButton(
  customId: string = "modmail_close_thread"
): ActionRowBuilder<ButtonBuilder> {
  const { ButtonStyle } = require("discord.js");

  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel("Close Thread")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🔒");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  return row;
}

/**
 * Create a claim ticket button component
 */
export function createClaimButton(): ActionRowBuilder<ButtonBuilder> {
  const { ButtonStyle } = require("discord.js");

  const button = new ButtonBuilder()
    .setCustomId("modmail_claim")
    .setLabel("Claim Ticket")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🎫");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  return row;
}

/**
 * Create comprehensive modmail action buttons for staff
 */
export function createModmailActionButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const { ButtonStyle } = require("discord.js");

  // Row 1: Claim and Mark Resolved
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("modmail_claim")
      .setLabel("Claim Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫"),
    new ButtonBuilder()
      .setCustomId("modmail_mark_resolved")
      .setLabel("Mark Resolved")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
  );

  // Row 2: Close and Ban
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("modmail_close_with_reason")
      .setLabel("Close with Reason")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
    new ButtonBuilder()
      .setCustomId("modmail_ban_user")
      .setLabel("Ban User")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔨")
  );

  return [row1, row2];
}

/**
 * Get the inactivity warning hours from config or environment
 */
export function getInactivityWarningHours(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 2 / 60; // 2 minutes in testing mode
  }

  return envExists(env.MODMAIL_INACTIVITY_WARNING_HOURS)
    ? env.MODMAIL_INACTIVITY_WARNING_HOURS
    : 24; // Default to 24 hours if not set
}

/**
 * Get the auto-close hours from config or environment
 */
export function getAutoCloseHours(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 5 / 60; // 5 minutes in testing mode
  }

  return envExists(env.MODMAIL_AUTO_CLOSE_HOURS) ? env.MODMAIL_AUTO_CLOSE_HOURS : 24 * 7; // Default to 7 days if not set
}

/**
 * Get the check interval in minutes
 */
export function getCheckIntervalMinutes(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 0.5; // 30 seconds in testing mode
  }

  return envExists(env.MODMAIL_CHECK_INTERVAL_MINUTES) ? env.MODMAIL_CHECK_INTERVAL_MINUTES : 30; // Default to 30 minutes if not set
}

/**
 * Format hours into a human-readable time string
 */
export function formatTimeHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const totalSeconds = Math.round(hours * 3600);

  // For very short durations (less than 1 minute), show seconds
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""}`;
  }

  // For durations less than 1 hour, show minutes
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}`;
  }

  // For durations 24 hours or longer, show days, hours, and minutes
  if (hours >= 24) {
    const wholeDays = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const remainingMinutes = Math.round((hours - Math.floor(hours)) * 60);

    const parts: string[] = [];
    parts.push(`${wholeDays} day${wholeDays !== 1 ? "s" : ""}`);
    if (remainingHours > 0) {
      parts.push(`${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`);
    }
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`);
    }

    return parts.join(" ");
  }

  // For longer durations (less than 24 hours), show hours and minutes
  const wholeHours = Math.floor(hours);
  const remainingMinutes = Math.round((hours - wholeHours) * 60);

  const parts: string[] = [];
  if (wholeHours > 0) {
    parts.push(`${wholeHours} hour${wholeHours !== 1 ? "s" : ""}`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`);
  }

  return parts.join(" ");
}

/**
 * Send a modmail close message to both user DMs and thread with consistent styling
 */
export async function sendModmailCloseMessage(
  client: Client<true>,
  modmail: ModmailType,
  closedBy: "User" | "Staff" | "System",
  closedByName: string,
  reason: string
): Promise<{ dmSuccess: boolean; threadSuccess: boolean }> {
  const embed = BasicEmbed(
    client,
    `Modmail Closed (${closedBy})`,
    `This modmail thread has been closed by ${closedBy.toLowerCase()} ${closedByName}.\n\nReason: ${reason}\n\nYou can open a modmail by sending another message to the bot.`,
    undefined,
    "Red"
  );

  return await sendMessageToBothChannels(client, modmail, embed);
}
