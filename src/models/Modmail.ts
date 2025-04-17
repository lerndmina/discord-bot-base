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
    userAvatar: {
      type: String,
      required: false,
    },
    userDisplayName: {
      type: String,
      required: false,
    },
  })
);
