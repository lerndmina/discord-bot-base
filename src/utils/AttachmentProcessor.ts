import { Attachment, AttachmentBuilder, Collection } from "discord.js";

/**
 * Creates AttachmentBuilder objects from Discord attachment URLs
 * This allows forwarding attachments without downloading and re-uploading them
 */
export function createAttachmentBuildersFromUrls(
  attachments: Collection<string, Attachment>
): AttachmentBuilder[] {
  const attachmentBuilders: AttachmentBuilder[] = [];

  for (const attachment of attachments.values()) {
    const attachmentBuilder = new AttachmentBuilder(attachment.url, {
      name: attachment.name || "attachment",
      description: attachment.description || undefined,
    });
    attachmentBuilders.push(attachmentBuilder);
  }

  return attachmentBuilders;
}
