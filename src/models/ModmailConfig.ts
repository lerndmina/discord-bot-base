import { Schema, model } from "mongoose";

const ModmailConfig = new Schema({
  guildId: {
    type: String,
    required: true,
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
});

export default model("ModmailConfig", ModmailConfig);
