import { InferSchemaType, Schema, model } from "mongoose";
import FetchEnvs from "../utils/FetchEnvs";
const env = FetchEnvs();

const modmailMessageSchema = new Schema(
  {
    messageId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["user", "staff"],
    },
    content: {
      type: String,
      required: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorAvatar: {
      type: String,
      required: false,
    },
    // Discord message references
    discordMessageId: {
      type: String,
      required: false,
    },
    discordMessageUrl: {
      type: String,
      required: false,
    },
    webhookMessageId: {
      type: String,
      required: false,
    },
    webhookMessageUrl: {
      type: String,
      required: false,
    },
    dmMessageId: {
      type: String,
      required: false,
    },
    dmMessageUrl: {
      type: String,
      required: false,
    },
    // Message metadata
    attachments: [
      {
        filename: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        contentType: {
          type: String,
          required: false,
        },
      },
    ],
    // Editing tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedContent: {
      type: String,
      required: false,
    },
    editedAt: {
      type: Date,
      required: false,
    },
    editedBy: {
      type: String,
      required: false,
    },
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // Internal flags
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      required: false,
    },
    deletedBy: {
      type: String,
      required: false,
    },
  },
  { _id: false }
); // Disable _id for subdocuments

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
  // New messages array for tracking all messages
  messages: {
    type: [modmailMessageSchema],
    default: [],
  },
});

export default model(env.MODMAIL_TABLE, modmailSchema);

export type ModmailType = InferSchemaType<typeof modmailSchema>;
export type ModmailMessageType = InferSchemaType<typeof modmailMessageSchema>;
