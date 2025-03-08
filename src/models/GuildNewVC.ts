import { Schema, model } from "mongoose";

export default model(
  "GuildNewVC",
  new Schema({
    guildID: {
      type: String,
      required: true,
    },
    guildChannelIDs: {
      type: [
        {
          channelID: String,
          categoryID: String,
        },
      ],
      default: {},
    },
  })
);
