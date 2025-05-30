import { InferSchemaType, Schema, model } from "mongoose";

// Schema for individual question responses
const QuestionResponseSchema = new Schema({
  questionIndex: {
    type: Number,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["multiple_choice", "shortform"],
    required: true,
  },
  response: {
    type: String,
    required: true,
  },
  // For multiple choice questions, store the selected option index
  selectedOptionIndex: {
    type: Number,
    required: false,
  },
});

// Main schema for questionnaire responses
const QuestionnaireResponseSchema = new Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    questionnaireName: {
      type: String,
      required: true,
      index: true,
    },
    responses: {
      type: [QuestionResponseSchema],
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sessionDuration: {
      type: Number, // Duration in milliseconds
      required: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound index for efficient queries
QuestionnaireResponseSchema.index({ guildId: 1, questionnaireName: 1, completedAt: -1 });
QuestionnaireResponseSchema.index({ userId: 1, completedAt: -1 });

export type QuestionnaireResponseType = InferSchemaType<typeof QuestionnaireResponseSchema>;
export type QuestionResponseType = InferSchemaType<typeof QuestionResponseSchema>;

export default model("QuestionnaireResponse", QuestionnaireResponseSchema);
