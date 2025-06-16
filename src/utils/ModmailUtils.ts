import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ThreadChannel,
  User,
  ButtonBuilder,
  ButtonStyle,
  ForumChannel,
  Guild,
  GuildMember,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { ModmailType } from "../models/Modmail";
import { ThingGetter } from "./TinyUtils";
import log from "./log";
import FetchEnvs, { envExists } from "./FetchEnvs";
import BasicEmbed from "./BasicEmbed";
import Database from "./data/database";
import Modmail from "../models/Modmail";
import ModmailConfig from "../models/ModmailConfig";

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
    `This modmail thread has been closed by ${closedBy.toLowerCase()} \`${closedByName}\`.\n\nReason: ${reason}\n\nYou can open a modmail by sending another message to the bot.`,
    undefined,
    "Red"
  );

  return await sendMessageToBothChannels(client, modmail, embed);
}

/**
 * Mark a modmail thread as resolved and notify the user
 */
export async function markModmailAsResolved(
  client: Client<true>,
  modmail: ModmailType & { _id: any },
  resolvedByUsername: string,
  resolvedByUserId: string
): Promise<{ success: boolean; alreadyResolved?: boolean; error?: string }> {
  try {
    const db = new Database();

    // Check if already marked as resolved
    if (modmail.markedResolved) {
      return { success: false, alreadyResolved: true };
    }

    // Update the modmail to mark as resolved
    await db.findOneAndUpdate(
      Modmail,
      { _id: modmail._id },
      {
        markedResolved: true,
        resolvedAt: new Date(),
        // Schedule auto-close in 24 hours
        autoCloseScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: false, new: true }
    );

    // Create buttons for user response
    const resolveButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("modmail_resolve_close")
        .setLabel("Close Thread")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId("modmail_resolve_continue")
        .setLabel("I Need More Help")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🆘")
    );

    // Create embed for resolution message
    const resolveEmbed = BasicEmbed(
      client,
      "✅ Issue Marked as Resolved",
      `Your support request has been marked as **resolved** by ${resolvedByUsername}.\n\n` +
        `• **Click "Close Thread"** if your issue is fully resolved\n` +
        `• **Click "I Need More Help"** if you need further assistance\n` +
        `• **Send a message** if you have additional questions\n\n` +
        `This thread will automatically close in **24 hours** if no action is taken.`,
      undefined,
      "Green"
    );

    // Send message to both channels - buttons only in DMs
    await sendMessageToBothChannels(client, modmail, resolveEmbed, undefined, {
      dmComponents: [resolveButtons],
      threadComponents: [], // No buttons in thread
    });

    log.info(`Modmail ${modmail._id} marked as resolved by staff member ${resolvedByUserId}`);

    return { success: true };
  } catch (error) {
    log.error("Error marking modmail as resolved:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Create a new modmail thread with consistent behavior
 */
export async function createModmailThread(
  client: Client<true>,
  options: {
    guild: Guild;
    targetUser: User;
    targetMember: GuildMember;
    forumChannel: ForumChannel;
    modmailConfig: any; // ModmailConfigType
    reason?: string;
    openedBy?: {
      type: "User" | "Staff";
      username: string;
      userId: string;
    };
    initialMessage?: string;
    forced?: boolean; // If --forced is used and therefore the message is short
  }
): Promise<
  | {
      success: boolean;
      thread?: ThreadChannel;
      modmail?: ModmailType & { _id: any };
      dmSuccess?: boolean;
      error?: string;
    }
  | undefined
> {
  try {
    const db = new Database();
    const getter = new ThingGetter(client);

    const {
      guild,
      targetUser,
      targetMember,
      forumChannel,
      modmailConfig,
      reason = "(no reason specified)",
      openedBy,
      initialMessage,
    } = options;

    // Clean cache for the user to prevent conflicts with stale data
    await db.cleanCache(`${env.MONGODB_DATABASE}:${env.MODMAIL_TABLE}:userId:${targetUser.id}`);

    // Check if modmail already exists
    const existingModmail = await db.findOne(Modmail, { userId: targetUser.id });
    if (existingModmail) {
      return {
        success: false,
        error: "A modmail thread is already open for this user",
      };
    }

    const memberName = targetMember.user.username; // targetMember.nickname || targetMember.user.displayName;

    // Determine thread name and initial content
    // Check if reason contains force flag and clean it
    let cleanedReason = reason;
    if (reason && reason.includes("-# the user has force")) {
      cleanedReason = reason.split("-# the user has force")[0].trim();
    }
    const threadName =
      cleanedReason && cleanedReason !== "(no reason specified)"
        ? `${memberName} | ${cleanedReason.substring(0, 50)}${
            cleanedReason.length > 50 ? "..." : ""
          }`
        : `${memberName} | Modmail`;

    let threadContent = "";
    if (openedBy?.type === "Staff") {
      threadContent = `Modmail thread opened for ${targetUser.tag} (<@${targetUser.id}>) by staff member ${openedBy.username} (${openedBy.userId})\n\nReason: ${reason}`;
    } else {
      threadContent = `Modmail thread for ${memberName} | ${targetUser.id} | <@${
        targetUser.id
      }>\n\n Original message: ${initialMessage || reason}${
        targetMember.pending ? "\n\nUser has not fully joined the guild." : ""
      }`;
    }

    // Create the thread
    const thread = await forumChannel.threads.create({
      name: threadName,
      autoArchiveDuration:
        openedBy?.type === "Staff"
          ? ThreadAutoArchiveDuration.OneHour
          : ThreadAutoArchiveDuration.OneWeek,
      message: {
        content: threadContent,
      },
    });

    // Ensure webhook exists for the config
    if (!modmailConfig.webhookId || !modmailConfig.webhookToken) {
      log.info("Creating new webhook for modmail config");
      const webhook = await forumChannel.createWebhook({
        name: "Modmail System",
        avatar: client.user.displayAvatarURL(),
        reason: "Modmail system webhook for relaying user messages.",
      });

      await db.findOneAndUpdate(
        ModmailConfig,
        { guildId: guild.id },
        {
          webhookId: webhook.id,
          webhookToken: webhook.token,
        },
        { new: true, upsert: true }
      );

      // Update the config object
      modmailConfig.webhookId = webhook.id;
      modmailConfig.webhookToken = webhook.token;
    }

    // Send staff notification with action buttons
    await thread.send({
      content: `<@&${modmailConfig.staffRoleId}>`,
      embeds: [
        BasicEmbed(
          client,
          "Modmail",
          `Hey! ${memberName} has opened a modmail thread!${
            openedBy?.type === "Staff" ? ` (opened by staff member ${openedBy.username})` : ""
          }`,
          undefined,
          "Random"
        ),
      ],
      components: createModmailActionButtons(),
    });

    // Create modmail entry in database
    const modmail = await db.findOneAndUpdate(
      Modmail,
      { userId: targetUser.id },
      {
        guildId: guild.id,
        forumThreadId: thread.id,
        forumChannelId: forumChannel.id,
        userId: targetUser.id,
        userAvatar: targetUser.displayAvatarURL(),
        userDisplayName: memberName,
        lastUserActivityAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    // Handle updating the tag for the thread
    const { handleTag } = require("../events/messageCreate/gotMail");
    if (modmailConfig) {
      await handleTag(modmail, modmailConfig, db, thread, forumChannel);
    } else {
      log.error(`Could not update tags: ModmailConfig is null for guild: ${guild.id}`);
    } // Send DM to user with close button
    let dmSuccess = false;
    try {
      const dmChannel = await targetUser.createDM();

      // Create close button for the DM
      const closeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("modmail_close_thread")
          .setLabel("Close Thread")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      await dmChannel.send({
        embeds: [
          BasicEmbed(
            client,
            openedBy?.type === "Staff" ? "Modmail Thread Opened" : "Modmail",
            openedBy?.type === "Staff"
              ? `Staff have opened a modmail thread for you. Please respond here to communicate with staff.`
              : `Successfully created a modmail thread in **${guild.name}**!\n\nWe will get back to you as soon as possible. While you wait, why not grab a hot beverage!\n\nOnce we have solved your issue, you can use the "Close Thread" button below or \`/modmail close\` to close the thread. If you need to send us more information, just send it here!\n\nIf you want to add more information to your original message, just send it here!`,
            reason && reason !== "(no reason specified)" && openedBy?.type === "Staff"
              ? [{ name: "Reason", value: reason, inline: false }]
              : [],
            openedBy?.type === "Staff" ? "Aqua" : "Random"
          ),
        ],
        components: [closeButton],
      });
      dmSuccess = true;
    } catch (error) {
      log.warn(`Failed to send DM to user ${targetUser.id}:`, error);
      dmSuccess = false;
    }
    return {
      success: true,
      thread,
      modmail: modmail as ModmailType & { _id: any },
      dmSuccess,
    };
  } catch (error) {
    log.error("Error creating modmail thread:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
