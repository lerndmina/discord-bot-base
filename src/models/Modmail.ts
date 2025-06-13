import { InferSchemaType, Schema, model } from "mongoose";
import FetchEnvs from "../utils/FetchEnvs";
const env = FetchEnvs();

const modmailSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  forumThreadId: {
    type: String,
    required: true,
  },
  forumChannelId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  userAvatar: {
    type: String,
    required: false,
  },
  userDisplayName: {
    type: String,
    required: false,
  },
  lastUserActivityAt: {
    type: Date,
    default: Date.now,
  },
  inactivityNotificationSent: {
    type: Date,
    required: false,
  },
  autoCloseScheduledAt: {
    type: Date,
    required: false,
  },
  autoCloseDisabled: {
    type: Boolean,
    default: false,
  },
  markedResolved: {
    type: Boolean,
    default: false,
  },
  resolvedAt: {
    type: Date,
    required: false,
  },
  claimedBy: {
    type: String,
    required: false,
  },
  claimedAt: {
    type: Date,
    required: false,
  },
});

export default model(env.MODMAIL_TABLE, modmailSchema);

export type ModmailType = InferSchemaType<typeof modmailSchema>;
