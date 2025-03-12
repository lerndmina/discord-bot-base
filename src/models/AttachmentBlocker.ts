import { InferSchemaType, Schema, model } from "mongoose";

export enum BlockType {
  WHITELIST = "whitelist",
  BLACKLIST = "blacklist",
}

export enum AttachmentType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  FILE = "file",
}

export const AttachmentTypesResolved = {
  [AttachmentType.IMAGE]: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"],
  [AttachmentType.VIDEO]: ["mp4", "mov", "avi", "mkv", "webm"],
  [AttachmentType.AUDIO]: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"],
  [AttachmentType.FILE]: ["all"],
};

const AttachmentBlocker = new Schema({
  channelId: {
    type: String,
    required: true,
    unique: true, // Prevent duplicate configurations for the same channel
    index: true, // Improve lookup performance
  },
  attachmentTypes: {
    type: [String],
    enum: Object.values(AttachmentType),
    default: [],
  },
  blockType: {
    type: String,
    enum: Object.values(BlockType),
    default: BlockType.WHITELIST,
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  timeoutDuration: {
    type: Number,
    default: 5 * 60 * 1000, // 5 minutes
  },
});

export default model("AttachmentBlocker", AttachmentBlocker);

export type AttachmentBlockerType = InferSchemaType<typeof AttachmentBlocker>;
