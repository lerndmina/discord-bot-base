import { Message, Client, ChannelType } from "discord.js";
import Database from "../../utils/data/database";
import log from "../../utils/log";
import AttachmentBlocker, {
  BlockType,
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
  if (!config || !config.blockType || config.attachmentTypes.length < 1) return;

  // Extract configuration
  const blockedTypes = config.attachmentTypes;
  const blockType = config.blockType;

  // Track if message should be deleted
  let shouldDelete = false;
  let blockedReasons: string[] = [];

  // Check each attachment
  for (const [_, attachment] of message.attachments.entries()) {
    // Get file extension
    const fileExtension = attachment.name?.split(".").pop()?.toLowerCase() || "";
    const mimeType = attachment.contentType?.toLowerCase() || "";

    // Determine attachment category
    let matchedType: AttachmentType | null = null;

    // Check which category this file belongs to
    for (const [type, extensions] of Object.entries(AttachmentTypesResolved)) {
      // Special case for the "all" extension
      if (type === AttachmentType.FILE && blockedTypes.includes(AttachmentType.FILE)) {
        matchedType = AttachmentType.FILE;
        break;
      }

      // Check if extension or mime type matches this category
      if (
        extensions.includes(fileExtension) ||
        (mimeType && mimeType.startsWith(type.toLowerCase()))
      ) {
        matchedType = type as AttachmentType;
        break;
      }
    }

    if (!matchedType) continue;

    // Apply whitelist/blacklist logic
    if (blockType === BlockType.WHITELIST) {
      // In whitelist mode, block if NOT in the allowed types

      if (blockedTypes.includes(AttachmentType.FILE)) {
        break; // If all files are allowed, no need to check further, this essentially allows all attachments
      }

      if (!blockedTypes.includes(matchedType)) {
        shouldDelete = true;
        blockedReasons.push(`${matchedType} attachments are not allowed`);
        break; // One blocked attachment is enough to delete the message
      }
    } else if (blockType === BlockType.BLACKLIST) {
      // In blacklist mode, block if IN the blocked types or all files are blocked
      if (blockedTypes.includes(matchedType) || blockedTypes.includes(AttachmentType.FILE)) {
        shouldDelete = true;
        blockedReasons.push(`${matchedType} attachments are not allowed`);
        break; // One blocked attachment is enough to delete the message
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
