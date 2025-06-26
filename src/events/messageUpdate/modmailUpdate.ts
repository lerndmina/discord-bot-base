import { Message, Client, PartialMessage } from "discord.js";
import ModmailMessageService from "../../services/ModmailMessageService";
import Database from "../../utils/data/database";
import Modmail from "../../models/Modmail";
import ModmailConfig from "../../models/ModmailConfig";
import log from "../../utils/log";
import { debugMsg } from "../../utils/TinyUtils";
import { removeMentions } from "../../Bot";

/**
 * Handle message updates in modmail threads and DMs
 * @param oldMessage - The message before the update
 * @param newMessage - The message after the update
 * @param client - Discord client
 */
export default async function (
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  client: Client<true>
) {
  // Skip bot messages
  if (newMessage.author?.bot) return;

  // Skip if we don't have the new message content
  if (!newMessage.content) return;

  // Skip if content hasn't actually changed
  if (oldMessage.content === newMessage.content) return;

  const messageService = new ModmailMessageService();
  const db = new Database();

  try {
    // Check if this is a DM message update
    if (!newMessage.guildId) {
      await handleDMMessageUpdate(oldMessage, newMessage, messageService, client);
      return;
    }

    // Check if this is a message in a modmail thread
    await handleThreadMessageUpdate(oldMessage, newMessage, messageService, db, client);
  } catch (error) {
    log.error(`Error handling message update: ${error}`);
  }
}

/**
 * Handle message updates in DMs (user editing their modmail messages)
 */
async function handleDMMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  messageService: ModmailMessageService,
  client: Client<true>
) {
  if (!newMessage.author) return;

  try {
    // Find the modmail thread for this user
    const db = new Database();
    const modmail = await db.findOne(Modmail, { userId: newMessage.author.id });
    if (!modmail) return;

    // Find the tracked message by Discord message ID
    const trackedMessage = await messageService.findMessageByDiscordId(
      newMessage.author.id,
      newMessage.id
    );

    if (!trackedMessage) {
      debugMsg(`No tracked message found for DM edit: ${newMessage.id}`);
      return;
    }

    // Update the message in our tracking system
    const cleanContent = removeMentions(newMessage.content || "");
    await messageService.editMessage(
      newMessage.author.id,
      trackedMessage.messageId,
      cleanContent,
      newMessage.author.id
    );

    log.debug(`Updated DM message ${trackedMessage.messageId} for user ${newMessage.author.id}`);

    // Update the corresponding webhook message in the forum thread
    await updateWebhookMessage(modmail, trackedMessage, cleanContent, client);
    log.debug(`Updated webhook message for tracked message ${trackedMessage.messageId}`);
  } catch (error) {
    log.error(`Error handling DM message update: ${error}`);
  }
}

/**
 * Handle message updates in modmail threads (staff editing their messages)
 */
async function handleThreadMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  messageService: ModmailMessageService,
  db: Database,
  client: Client<true>
) {
  if (!newMessage.author || !newMessage.channelId) return;

  try {
    // Check if this is a modmail thread
    const modmail = await db.findOne(Modmail, { forumThreadId: newMessage.channelId });
    if (!modmail) return;

    // Skip messages that start with "." (staff-only messages)
    if (newMessage.content?.startsWith(".")) return;

    // Find the tracked message by Discord message ID
    const trackedMessage = await messageService.findMessageByDiscordId(
      modmail.userId,
      newMessage.id
    );

    if (!trackedMessage) {
      debugMsg(`No tracked message found for thread edit: ${newMessage.id}`);
      return;
    }

    // Update the message in our tracking system
    const cleanContent = removeMentions(newMessage.content || "");
    await messageService.editMessage(
      modmail.userId,
      trackedMessage.messageId,
      cleanContent,
      newMessage.author.id
    );

    log.debug(
      `Updated thread message ${trackedMessage.messageId} for user ${modmail.userId} by staff ${newMessage.author.id}`
    );

    // Update the corresponding DM message to the user
    await updateDMMessage(modmail, trackedMessage, cleanContent, client);
    log.debug(`Updated DM message for tracked message ${trackedMessage.messageId}`);
  } catch (error) {
    log.error(`Error handling thread message update: ${error}`);
  }
}

/**
 * Update webhook message in forum thread when user edits DM
 */
async function updateWebhookMessage(
  modmail: any,
  trackedMessage: any,
  newContent: string,
  client: Client<true>
) {
  try {
    if (!trackedMessage.webhookMessageUrl) {
      log.error("No webhook message URL found for editing");
      return;
    }

    log.debug(`About to edit webhook message with URL: ${trackedMessage.webhookMessageUrl}`);
    log.debug(`Modmail guild ID: ${modmail.guildId}`);
    log.debug(`Tracked message ID: ${trackedMessage.messageId}`);

    // Get webhook credentials from config
    const db = new Database();
    const config = await db.findOne(ModmailConfig, { guildId: modmail.guildId });
    if (!config || !config.webhookId || !config.webhookToken) {
      log.error("No webhook credentials found in config for editing");
      return;
    }

    // Remove any existing strikethrough or edit indicators, then add edit indicator
    const cleanContent = newContent.replace(/~~/g, "").replace(/ _\((edited|deleted)\)_$/g, "");

    const success = await ModmailMessageService.editMessageFromUrl(
      client,
      trackedMessage.webhookMessageUrl,
      cleanContent + " _(edited)_",
      config.webhookId,
      config.webhookToken
    );

    if (success) {
      log.debug(`Updated webhook message via URL: ${trackedMessage.webhookMessageUrl}`);
    } else {
      log.error(`Failed to update webhook message via URL: ${trackedMessage.webhookMessageUrl}`);
    }
  } catch (error) {
    log.error(`Failed to update webhook message: ${error}`);
  }
}

/**
 * Update DM message to user when staff edits thread message
 */
async function updateDMMessage(
  modmail: any,
  trackedMessage: any,
  newContent: string,
  client: Client<true>
) {
  try {
    if (!trackedMessage.dmMessageUrl) {
      log.error("No DM message URL found for editing");
      return;
    }

    // Remove any existing strikethrough or edit indicators, then add edit indicator
    const cleanContent = newContent.replace(/~~/g, "").replace(/ _\((edited|deleted)\)_$/g, "");

    const success = await ModmailMessageService.editMessageFromUrl(
      client,
      trackedMessage.dmMessageUrl,
      cleanContent + " _(edited)_"
    );

    if (success) {
      log.debug(`Updated DM message via URL: ${trackedMessage.dmMessageUrl}`);
    } else {
      log.error(`Failed to update DM message via URL: ${trackedMessage.dmMessageUrl}`);
    }
  } catch (error) {
    log.error(`Failed to update DM message: ${error}`);
  }
}
