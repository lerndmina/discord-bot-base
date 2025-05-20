import { InferSchemaType, Schema, model } from "mongoose";

export enum ModmailStatus {
  OPEN = "open",
  CLOSED = "closed",
}

const tagsSchema = new Schema(
  {
    snowflake: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ModmailStatus),
      default: ModmailStatus.OPEN,
    },
  },
  { _id: false }
);

const ModmailConfig = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  guildDescription: {
    type: String,
    required: false,
  },
  forumChannelId: {
    type: String,
    required: true,
  },
  staffRoleId: {
    type: String,
    required: true,
  },
  webhookId: {
    type: String,
    required: false,
  },
  webhookToken: {
    type: String,
    required: false,
  },
  tags: {
    type: [tagsSchema],
    required: false,
  },
});

export default model("ModmailConfig", ModmailConfig);
export type ModmailConfigType = InferSchemaType<typeof ModmailConfig>;
