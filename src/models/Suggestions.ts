import { InferSchemaType, Schema, model } from "mongoose";

export enum VoteType {
  Upvote = "upvote",
  Downvote = "downvote",
}

export enum SuggestionStatus {
  Pending = "pending",
  Approved = "approved",
  Denied = "denied",
}

const VotesSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  vote: {
    type: String,
    enum: [VoteType.Upvote, VoteType.Downvote],
    required: true,
  },
});

const Suggestion = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
  messageId: {
    type: String,
    required: false, // Set as null to begin with then update it later
  },
  userId: {
    type: String,
    required: true,
  },
  suggestion: {
    type: String,
    required: true,
  },
  votes: {
    type: [VotesSchema],
    default: [],
  },
  status: {
    type: String,
    enum: [SuggestionStatus.Pending, SuggestionStatus.Approved, SuggestionStatus.Denied],
    default: SuggestionStatus.Pending,
  },
});

// Create the model
const SuggestionModel = model("Suggestion", Suggestion);

export type SuggestionConfigType = InferSchemaType<typeof Suggestion>;

export default SuggestionModel;
