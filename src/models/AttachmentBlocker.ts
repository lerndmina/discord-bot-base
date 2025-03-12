import { InferSchemaType, Schema, model } from "mongoose";

export enum AttachmentType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  ALL = "all",
}

export const AttachmentTypesResolved = {
  [AttachmentType.IMAGE]: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
  ],
  [AttachmentType.VIDEO]: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  [AttachmentType.AUDIO]: [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/x-m4a",
    "audio/aac",
    "audio/x-ms-wma",
  ],
  [AttachmentType.ALL]: ["all"],
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
