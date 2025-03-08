import { Schema, model } from "mongoose";
import FetchEnvs from "../utils/FetchEnvs";
const env = FetchEnvs();

export default model(
  env.MODMAIL_TABLE,
  new Schema({
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
    webhookId: {
      type: String,
      required: true,
    },
    webhookToken: {
      type: String,
      required: true,
    },
  })
);
