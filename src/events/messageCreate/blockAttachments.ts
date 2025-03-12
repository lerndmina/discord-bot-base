import { Message, Client, ChannelType } from "discord.js";
import Database from "../../utils/data/database";
import log from "../../utils/log";
import AttachmentBlocker, {
  AttachmentType,
  AttachmentTypesResolved,
} from "../../models/AttachmentBlocker";
import { ThingGetter } from "../../utils/TinyUtils";
import BasicEmbed from "../../utils/BasicEmbed";

export default async (message: Message, client: Client<true>) => {
  // Skip if from a bot, has no attachments, or is in DMs
  if (message.author.bot || message.attachments.size < 1 || message.channel.type === ChannelType.DM)
    return;

  const db = new Database();
  const getter = new ThingGetter(client);
  const channelId = message.channel.id;

  // Get channel configuration
  const config = await db.findOne(AttachmentBlocker, { channelId }, true);
  if (!config || config.attachmentTypes.length < 1) return;

  // Track if message should be deleted
  let shouldDelete = false;
  let blockedReasons: string[] = [];

  // Check each attachment
  for (const [_, attachment] of message.attachments.entries()) {
    // Get file extension
    const fileExtension = attachment.name?.split(".").pop()?.toLowerCase() || "";
    const mimeType = attachment.contentType?.toLowerCase() || "";

    // Check if attachment type is allowed
    let isAllowed = false;
    for (const type of config.attachmentTypes) {
      if (
        AttachmentTypesResolved[type].includes(mimeType) ||
        AttachmentTypesResolved[type].includes("all")
      ) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      shouldDelete = true;
      if (blockedReasons.length < 1) {
        blockedReasons.push(`Attachment type(s) not allowed ${mimeType}`);
      } else {
        blockedReasons.push(`, ${mimeType}`);
      }
    }
  }

  // Delete message if needed
  if (shouldDelete && message.deletable) {
    try {
      await message.delete();
      if (config.timeoutDuration > 0) {
        const member = await getter.getMember(message.guild!, message.author.id);
        if (!member) return;

        log.debug(`Timing out user ${message.author.tag} for ${config.timeoutDuration}ms`);

        member
          .timeout(config.timeoutDuration, `AttachmentBlocker: ${blockedReasons.join(", ")}`)
          .catch((e) => {
            log.error("Error timing out user", e);
          });
      }
      try {
        await message.author.send({
          embeds: [
            BasicEmbed(
              client,
              "Attachment Blocker",
              `Your message in ${message.channel.name} was removed: ${blockedReasons.join(", ")}${
                config.timeoutDuration > 0
                  ? `\n\nYou have also been timed out for ${config.timeoutDuration / 1000} seconds.`
                  : ""
              }`
            ),
          ],
        });
      } catch (e) {
        // User might have DMs disabled, just log it
        log.debug(`Couldn't DM user ${message.author.tag} about blocked attachment`);
      }

      log.info(
        `Blocked attachment from ${message.author.tag} in #${
          message.channel.name
        }: ${blockedReasons.join(", ")}`
      );
    } catch (error) {
      log.error("Error deleting message with blocked attachment", error);
    }
  }
};
