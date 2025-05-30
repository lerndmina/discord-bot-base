import {
  QuestionType,
  Question,
  createMultipleChoiceQuestion,
  createStringQuestion,
} from "../models/Questionnaire";
import QuestionnaireService from "./QuestionnaireService";

/**
 * A simple builder for creating questionnaires with a fluent interface
 *
 * @example
 * ```typescript
 * const questionnaire = new QuestionnaireBuilder("guild123", "Feedback Survey")
 *   .setDescription("Please provide your feedback")
 *   .addMultipleChoice("How satisfied are you?", ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"])
 *   .addShortForm("What can we improve?", "Enter your suggestions here...")
 *   .addMultipleChoice("Would you recommend us?", ["Yes", "No", "Maybe"])
 *   .build();
 * ```
 */
export default class QuestionnaireBuilder {
  private guildId: string;
  private name: string;
  private description: string = "";
  private questions: Question[] = [];

  /**
   * Create a new questionnaire builder
   * @param guildId The guild ID where this questionnaire belongs
   * @param name The name of the questionnaire
   */
  constructor(guildId: string, name: string) {
    this.guildId = guildId;
    this.name = name;
  }

  /**
   * Set the description for the questionnaire
   * @param description The description text
   * @returns The builder instance for chaining
   */
  setDescription(description: string): QuestionnaireBuilder {
    this.description = description;
    return this;
  }

  /**
   * Add a multiple choice question
   * @param question The question text
   * @param options Array of options (minimum 2 required)
   * @returns The builder instance for chaining
   */
  addMultipleChoice(question: string, options: string[]): QuestionnaireBuilder {
    if (options.length < 2) {
      throw new Error("Multiple choice questions must have at least 2 options");
    }
    this.questions.push(createMultipleChoiceQuestion(question, options));
    return this;
  }

  /**
   * Add a short form text question
   * @param question The question text
   * @param placeholder Optional placeholder text for the input field
   * @returns The builder instance for chaining
   */
  addShortForm(question: string, placeholder?: string): QuestionnaireBuilder {
    this.questions.push(createStringQuestion(question, placeholder));
    return this;
  }

  /**
   * Add a yes/no question (convenience method for binary choice)
   * @param question The question text
   * @returns The builder instance for chaining
   */
  addYesNo(question: string): QuestionnaireBuilder {
    return this.addMultipleChoice(question, ["Yes", "No"]);
  }

  /**
   * Add a rating question with a 1-5 scale
   * @param question The question text
   * @returns The builder instance for chaining
   */
  addRating(question: string): QuestionnaireBuilder {
    return this.addMultipleChoice(question, [
      "1 - Poor",
      "2 - Fair",
      "3 - Good",
      "4 - Very Good",
      "5 - Excellent",
    ]);
  }

  /**
   * Add a custom question object directly
   * @param question The question object
   * @returns The builder instance for chaining
   */
  addCustomQuestion(question: Question): QuestionnaireBuilder {
    this.questions.push(question);
    return this;
  }

  /**
   * Get the current number of questions
   * @returns The number of questions added so far
   */
  getQuestionCount(): number {
    return this.questions.length;
  }

  /**
   * Get a preview of all questions without saving
   * @returns Array of all questions added so far
   */
  getQuestions(): Question[] {
    return [...this.questions]; // Return a copy
  }

  /**
   * Clear all questions from the builder
   * @returns The builder instance for chaining
   */
  clearQuestions(): QuestionnaireBuilder {
    this.questions = [];
    return this;
  }

  /**
   * Validate the current questionnaire configuration
   * @throws Error if validation fails
   */
  private validate(): void {
    if (!this.guildId.trim()) {
      throw new Error("Guild ID is required");
    }
    if (!this.name.trim()) {
      throw new Error("Questionnaire name is required");
    }
    if (!this.description.trim()) {
      throw new Error("Description is required");
    }
    if (this.questions.length === 0) {
      throw new Error("At least one question is required");
    }
  }

  /**
   * Build and save the questionnaire
   * @returns Promise that resolves to the created questionnaire or null if it already exists
   * @throws Error if validation fails or if questionnaire creation fails
   */
  async build() {
    this.validate();

    try {
      const result = await QuestionnaireService.create(
        this.guildId,
        this.name,
        this.description,
        this.questions
      );

      if (result === null) {
        throw new Error(`Questionnaire with name "${this.name}" already exists in this guild`);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to create questionnaire");
    }
  }

  /**
   * Create a questionnaire configuration without saving it
   * Useful for previewing or manual saving
   * @returns The questionnaire configuration object
   */
  buildConfig() {
    this.validate();

    return {
      guildId: this.guildId,
      name: this.name,
      description: this.description,
      questions: this.questions,
    };
  }

  /**
   * Reset the builder to its initial state (keeping guildId and name)
   * @returns The builder instance for chaining
   */
  reset(): QuestionnaireBuilder {
    this.description = "";
    this.questions = [];
    return this;
  }

  /**
   * Create a copy of this builder with the same configuration
   * @param newName Optional new name for the copied questionnaire
   * @returns A new builder instance with the same configuration
   */
  clone(newName?: string): QuestionnaireBuilder {
    const clone = new QuestionnaireBuilder(this.guildId, newName || this.name);
    clone.description = this.description;
    clone.questions = [...this.questions];
    return clone;
  }
}
