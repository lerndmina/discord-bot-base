import { InferSchemaType, Schema, model } from "mongoose";

export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  SHORTFORM = "shortform",
}

export interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  type: QuestionType.MULTIPLE_CHOICE;
}

export interface StringQuestion {
  question: string;
  placeholder?: string;
  type: QuestionType.SHORTFORM;
}

export type Question = MultipleChoiceQuestion | StringQuestion;

// Type guards for runtime type checking
export function isMultipleChoiceQuestion(question: any): question is MultipleChoiceQuestion {
  return question?.type === QuestionType.MULTIPLE_CHOICE;
}

export function isStringQuestion(question: any): question is StringQuestion {
  return question?.type === QuestionType.SHORTFORM;
}

export function validateQuestion(question: any): question is Question {
  return isMultipleChoiceQuestion(question) || isStringQuestion(question);
}

// Utility function to create questions with proper typing
export function createMultipleChoiceQuestion(
  question: string,
  options: string[]
): MultipleChoiceQuestion {
  if (options.length < 2) {
    throw new Error("Multiple choice questions must have at least 2 options");
  }
  return {
    question,
    options,
    type: QuestionType.MULTIPLE_CHOICE,
  };
}

export function createStringQuestion(question: string, placeholder?: string): StringQuestion {
  return {
    question,
    placeholder,
    type: QuestionType.SHORTFORM,
  };
}

// Question schema with validation
const QuestionSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
    },
    // Multiple choice specific fields
    options: {
      type: [String],
      required: function (this: any) {
        return this.type === QuestionType.MULTIPLE_CHOICE;
      },
      validate: {
        validator: function (this: any, options: string[]) {
          if (this.type === QuestionType.MULTIPLE_CHOICE) {
            return options && options.length >= 2;
          }
          return true; // Not required for string questions
        },
        message: "Multiple choice questions must have at least 2 options",
      },
    },
    // String question specific fields
    placeholder: {
      type: String,
      required: false,
      validate: {
        validator: function (this: any, placeholder: string) {
          // Only allow placeholder for string questions
          if (this.type === QuestionType.MULTIPLE_CHOICE && placeholder) {
            return false;
          }
          return true;
        },
        message: "Placeholder is only allowed for string questions",
      },
    },
  },
  { _id: false }
);

// Main questionnaire schema
const QuestionnaireSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  questions: {
    type: [QuestionSchema],
    required: true,
    validate: {
      validator: function (questions: any[]) {
        return questions && questions.length > 0;
      },
      message: "At least one question is required",
    },
  },
});

// Add validation at the document level
QuestionnaireSchema.pre("validate", function () {
  if (this.questions) {
    for (const question of this.questions) {
      if (!validateQuestion(question)) {
        throw new Error(`Invalid question: ${JSON.stringify(question)}`);
      }
    }
  }
});

export default model("QuestionnaireSchema", QuestionnaireSchema);

export type QuestionnaireType = InferSchemaType<typeof QuestionnaireSchema>;
