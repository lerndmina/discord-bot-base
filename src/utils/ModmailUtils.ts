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
import FetchEnvs from "./FetchEnvs";

const env = FetchEnvs();

/**
 * Send a message to both the user's DMs and the modmail thread
 */
export async function sendMessageToBothChannels(
  client: Client<true>,
  modmail: ModmailType,
  embed: EmbedBuilder,
  content?: string,
  components?: ActionRowBuilder<ButtonBuilder>[]
): Promise<{ dmSuccess: boolean; threadSuccess: boolean }> {
  const getter = new ThingGetter(client);
  let dmSuccess = false;
  let threadSuccess = false;

  // Send to user DMs
  try {
    const user = await getter.getUser(modmail.userId);
    if (user) {
      await user.send({
        content,
        embeds: [embed],
        components: components || [],
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
        components: components || [],
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
 * Get the inactivity warning hours from config or environment
 */
export function getInactivityWarningHours(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 2 / 60; // 2 minutes in testing mode
  }

  return env.MODMAIL_INACTIVITY_WARNING_HOURS;
}

/**
 * Get the auto-close hours from config or environment
 */
export function getAutoCloseHours(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 5 / 60; // 5 minutes in testing mode
  }

  return env.MODMAIL_AUTO_CLOSE_HOURS;
}

/**
 * Get the check interval in minutes
 */
export function getCheckIntervalMinutes(): number {
  if (env.MODMAIL_TESTING_MODE) {
    return 0.5; // 30 seconds in testing mode
  }

  return env.MODMAIL_CHECK_INTERVAL_MINUTES;
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

  // For longer durations, show hours and minutes
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
