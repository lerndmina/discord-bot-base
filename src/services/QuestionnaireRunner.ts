import {
  Client,
  User,
  Guild,
  TextChannel,
  Message,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  MessageCollector,
  ComponentType,
  InteractionType,
} from "discord.js";
import { QuestionnaireType } from "../models/Questionnaire";
import {
  QuestionnaireSession,
  QuestionnaireResponse,
  QuestionInteractionHandler,
} from "./QuestionInteractionHandler";
import { isMultipleChoiceQuestion, isStringQuestion } from "../models/Questionnaire";
import QuestionnaireResponseModel from "../models/QuestionnaireResponse";
import log from "../utils/log";
import { v4 as uuidv4 } from "uuid";

/**
 * Main service for running interactive questionnaires
 */
export default class QuestionnaireRunner {
  private static sessions = new Map<string, QuestionnaireSession>();
  private static timeouts = new Map<string, NodeJS.Timeout>();
  private static collectors = new Map<string, MessageCollector>();

  /**
   * Start a new questionnaire session
   */
  static async startQuestionnaire(
    questionnaire: QuestionnaireType,
    user: User,
    guild: Guild,
    channel: TextChannel,
    client: Client
  ): Promise<string | null> {
    // Check if user already has an active session
    const existingSessionId = this.findActiveSession(user.id, guild.id);
    if (existingSessionId) {
      await channel.send({
        embeds: [
          QuestionInteractionHandler.createProgressEmbed(
            this.sessions.get(existingSessionId)!,
            user
          ),
        ],
        content:
          "You already have an active questionnaire session. Please complete or cancel it first.",
      });
      return null;
    }

    const sessionId = uuidv4();
    const session: QuestionnaireSession = {
      userId: user.id,
      guildId: guild.id,
      questionnaireName: questionnaire.name,
      questions: questionnaire.questions,
      currentQuestionIndex: 0,
      responses: [],
      startedAt: new Date(),
      lastActivityAt: new Date(),
      channelId: channel.id,
    };

    this.sessions.set(sessionId, session);
    this.setupTimeouts(sessionId, client);

    // Start with the first question
    await this.displayQuestion(sessionId, client);

    return sessionId;
  }

  /**
   * Display the current question to the user
   */
  static async displayQuestion(sessionId: string, client: Client): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const question = session.questions[session.currentQuestionIndex];
    if (!question) {
      await this.completeQuestionnaire(sessionId, client);
      return;
    }

    try {
      const user = await client.users.fetch(session.userId);
      const channel = (await client.channels.fetch(session.channelId)) as TextChannel;

      const embed = QuestionInteractionHandler.createQuestionEmbed(
        question,
        session.currentQuestionIndex,
        session.questions.length,
        session.questionnaireName,
        user
      );

      let components: any[] = [];

      if (isMultipleChoiceQuestion(question)) {
        components = QuestionInteractionHandler.createMultipleChoiceComponents(
          question,
          session.currentQuestionIndex,
          sessionId,
          false // TODO: Add support for multiple selection configuration
        );
      } else if (isStringQuestion(question)) {
        components = QuestionInteractionHandler.createShortFormComponents(
          question,
          session.currentQuestionIndex,
          sessionId
        );
      }

      const message = await channel.send({
        embeds: [embed],
        components,
      });

      session.messageId = message.id;
      session.lastActivityAt = new Date();

      // Set up message collector for text responses if it's a string question
      if (isStringQuestion(question)) {
        this.setupMessageCollector(sessionId, channel, user, client);
      }
    } catch (error) {
      log.error("Error displaying question:", error);
      await this.cancelQuestionnaire(
        sessionId,
        client,
        "An error occurred while displaying the question."
      );
    }
  }

  /**
   * Handle button interactions
   */
  static async handleButtonInteraction(
    interaction: ButtonInteraction,
    client: Client
  ): Promise<boolean> {
    const customId = interaction.customId;
    if (!customId.startsWith("questionnaire:")) return false;

    const parts = customId.split(":");
    const sessionId = parts[1];
    const action = parts[2];

    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== interaction.user.id) {
      await interaction.reply({
        content: "This questionnaire session is not valid or doesn't belong to you.",
        ephemeral: true,
      });
      return true;
    }

    session.lastActivityAt = new Date();

    switch (action) {
      case "mc": // Multiple choice button
        await this.handleMultipleChoiceButton(interaction, sessionId, parts, client);
        break;
      case "submit": // Submit multiple choice selections
        await this.handleSubmitButton(interaction, sessionId, client);
        break;
      case "modal": // Show modal for text input
        await this.handleModalButton(interaction, sessionId, parts, client);
        break;
      case "message": // Switch to message collector mode
        await this.handleMessageButton(interaction, sessionId, client);
        break;
      case "prev": // Previous question
        await this.handlePreviousButton(interaction, sessionId, client);
        break;
      case "skip": // Skip question
        await this.handleSkipButton(interaction, sessionId, client);
        break;
      case "cancel": // Cancel questionnaire
        await this.handleCancelButton(interaction, sessionId, client);
        break;
    }

    return true;
  }

  /**
   * Handle select menu interactions
   */
  static async handleSelectMenuInteraction(
    interaction: StringSelectMenuInteraction,
    client: Client
  ): Promise<boolean> {
    const customId = interaction.customId;
    if (!customId.startsWith("questionnaire:")) return false;

    const parts = customId.split(":");
    const sessionId = parts[1];
    const action = parts[2];

    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== interaction.user.id) {
      await interaction.reply({
        content: "This questionnaire session is not valid or doesn't belong to you.",
        ephemeral: true,
      });
      return true;
    }

    if (action === "select") {
      await this.handleSelectMenuChoice(interaction, sessionId, parts, client);
    }

    return true;
  }

  /**
   * Handle modal submit interactions
   */
  static async handleModalSubmit(
    interaction: ModalSubmitInteraction,
    client: Client
  ): Promise<boolean> {
    const customId = interaction.customId;
    if (!customId.startsWith("questionnaire:")) return false;

    const parts = customId.split(":");
    const sessionId = parts[1];
    const action = parts[2];

    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== interaction.user.id) {
      await interaction.reply({
        content: "This questionnaire session is not valid or doesn't belong to you.",
        ephemeral: true,
      });
      return true;
    }

    if (action === "modal_submit") {
      await this.handleModalSubmission(interaction, sessionId, parts, client);
    }

    return true;
  }

  /**
   * Handle multiple choice button selection
   */
  private static async handleMultipleChoiceButton(
    interaction: ButtonInteraction,
    sessionId: string,
    parts: string[],
    client: Client
  ): Promise<void> {
    const questionIndex = parseInt(parts[3]);
    const optionIndex = parseInt(parts[4]);
    const selectionType = parts[5]; // 'single' or 'multi'

    const session = this.sessions.get(sessionId)!;
    const question = session.questions[questionIndex];

    if (!isMultipleChoiceQuestion(question)) return;

    const selectedOption = question.options[optionIndex];

    if (selectionType === "single") {
      // Single selection - immediately save and move to next question
      await this.saveResponse(sessionId, questionIndex, selectedOption);
      await interaction.update({
        content: `✅ **Selected:** ${selectedOption}`,
        embeds: [],
        components: [],
      });

      session.currentQuestionIndex++;
      setTimeout(() => this.displayQuestion(sessionId, client), 1000);
    } else {
      // Multiple selection - update button states (TODO: implement)
      await interaction.reply({
        content: `Selected: ${selectedOption}. Click "Submit Selected Answers" when done.`,
        ephemeral: true,
      });
    }
  }

  /**
   * Handle select menu choice
   */
  private static async handleSelectMenuChoice(
    interaction: StringSelectMenuInteraction,
    sessionId: string,
    parts: string[],
    client: Client
  ): Promise<void> {
    const questionIndex = parseInt(parts[3]);
    const selectionType = parts[4];

    const session = this.sessions.get(sessionId)!;
    const question = session.questions[questionIndex];

    if (!isMultipleChoiceQuestion(question)) return;

    const selectedOptions = interaction.values.map((value) => question.options[parseInt(value)]);
    const answer = selectionType === "single" ? selectedOptions[0] : selectedOptions;

    await this.saveResponse(sessionId, questionIndex, answer);

    await interaction.update({
      content: `✅ **Selected:** ${Array.isArray(answer) ? answer.join(", ") : answer}`,
      embeds: [],
      components: [],
    });

    session.currentQuestionIndex++;
    setTimeout(() => this.displayQuestion(sessionId, client), 1000);
  }

  /**
   * Handle modal button click
   */
  private static async handleModalButton(
    interaction: ButtonInteraction,
    sessionId: string,
    parts: string[],
    client: Client
  ): Promise<void> {
    const questionIndex = parseInt(parts[3]);
    const session = this.sessions.get(sessionId)!;
    const question = session.questions[questionIndex];

    if (!isStringQuestion(question)) return;

    const modal = QuestionInteractionHandler.createTextInputModal(
      question,
      questionIndex,
      sessionId
    );
    await interaction.showModal(modal);
  }

  /**
   * Handle modal submission
   */
  private static async handleModalSubmission(
    interaction: ModalSubmitInteraction,
    sessionId: string,
    parts: string[],
    client: Client
  ): Promise<void> {
    const questionIndex = parseInt(parts[3]);
    const response = interaction.fields.getTextInputValue("response");

    await this.saveResponse(sessionId, questionIndex, response);

    await interaction.reply({
      content: `✅ **Your response:** ${
        response.length > 100 ? response.substring(0, 97) + "..." : response
      }`,
      ephemeral: true,
    });

    const session = this.sessions.get(sessionId)!;
    session.currentQuestionIndex++;
    setTimeout(() => this.displayQuestion(sessionId, client), 1000);
  }

  /**
   * Handle message mode button
   */
  private static async handleMessageButton(
    interaction: ButtonInteraction,
    sessionId: string,
    client: Client
  ): Promise<void> {
    await interaction.reply({
      content:
        "💬 **Message mode activated!** Please type your response in this channel. You have 30 minutes to respond.",
      ephemeral: true,
    });
  }

  /**
   * Handle previous button
   */
  private static async handlePreviousButton(
    interaction: ButtonInteraction,
    sessionId: string,
    client: Client
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;

    if (session.currentQuestionIndex > 0) {
      session.currentQuestionIndex--;
      // Remove the last response if going back
      if (session.responses.length > session.currentQuestionIndex) {
        session.responses.pop();
      }

      await interaction.update({
        content: "⬅️ Going back to previous question...",
        embeds: [],
        components: [],
      });

      setTimeout(() => this.displayQuestion(sessionId, client), 1000);
    } else {
      await interaction.reply({
        content: "You're already at the first question.",
        ephemeral: true,
      });
    }
  }

  /**
   * Handle skip button
   */
  private static async handleSkipButton(
    interaction: ButtonInteraction,
    sessionId: string,
    client: Client
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;

    await this.saveResponse(sessionId, session.currentQuestionIndex, "[Skipped]");

    await interaction.update({
      content: "⏭️ Question skipped.",
      embeds: [],
      components: [],
    });

    session.currentQuestionIndex++;
    setTimeout(() => this.displayQuestion(sessionId, client), 1000);
  }

  /**
   * Handle cancel button
   */
  private static async handleCancelButton(
    interaction: ButtonInteraction,
    sessionId: string,
    client: Client
  ): Promise<void> {
    await interaction.update({
      content: "❌ Questionnaire cancelled.",
      embeds: [],
      components: [],
    });

    await this.cancelQuestionnaire(sessionId, client, "Questionnaire was cancelled by the user.");
  }

  /**
   * Handle submit button for multiple choice questions
   */
  private static async handleSubmitButton(
    interaction: ButtonInteraction,
    sessionId: string,
    client: Client
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;
    const question = session.questions[session.currentQuestionIndex];

    if (!isMultipleChoiceQuestion(question)) {
      await interaction.reply({
        content: "❌ This question doesn't support multiple selection.",
        ephemeral: true,
      });
      return;
    }

    // Get the current selected answers (this would need to be tracked in session state)
    // For now, we'll implement basic functionality
    await interaction.reply({
      content: "✅ Multiple selection submitted! (Full implementation pending)",
      ephemeral: true,
    });

    session.currentQuestionIndex++;
    setTimeout(() => this.displayQuestion(sessionId, client), 1000);
  }

  /**
   * Save a response and update session
   */
  private static async saveResponse(
    sessionId: string,
    questionIndex: number,
    answer: string | string[]
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const question = session.questions[questionIndex];

    const response: QuestionnaireResponse = {
      questionIndex,
      question: question.question,
      answer,
      timestamp: new Date(),
    };

    // Remove any existing response for this question index
    session.responses = session.responses.filter((r) => r.questionIndex !== questionIndex);
    session.responses.push(response);
    session.lastActivityAt = new Date();
  }
  /**
   * Complete the questionnaire
   */
  private static async completeQuestionnaire(sessionId: string, client: Client): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const user = await client.users.fetch(session.userId);
      const channel = (await client.channels.fetch(session.channelId)) as TextChannel;

      // Save responses to database
      await this.saveQuestionnaireResponse(session, user);

      const completionEmbed = QuestionInteractionHandler.createCompletionEmbed(session, user);

      await channel.send({
        embeds: [completionEmbed],
        content: `🎉 Congratulations ${user}! You've completed the questionnaire.`,
      });

      log.info(
        `Questionnaire completed by ${user.username} (${user.id}) in guild ${session.guildId}`
      );
    } catch (error) {
      log.error("Error completing questionnaire:", error);
    } finally {
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Cancel the questionnaire
   */
  private static async cancelQuestionnaire(
    sessionId: string,
    client: Client,
    reason: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const user = await client.users.fetch(session.userId);
      log.info(`Questionnaire cancelled for ${user.username} (${user.id}): ${reason}`);
    } catch (error) {
      log.error("Error cancelling questionnaire:", error);
    } finally {
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Setup message collector for text responses
   */
  private static setupMessageCollector(
    sessionId: string,
    channel: TextChannel,
    user: User,
    client: Client
  ): void {
    const filter = (m: Message) => m.author.id === user.id && !m.author.bot;
    const collector = channel.createMessageCollector({
      filter,
      time: 30 * 60 * 1000, // 30 minutes
      max: 1,
    });

    collector.on("collect", async (message) => {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      await this.saveResponse(sessionId, session.currentQuestionIndex, message.content);

      await message.reply({
        content: `✅ **Your response recorded:** ${
          message.content.length > 100 ? message.content.substring(0, 97) + "..." : message.content
        }`,
      });

      session.currentQuestionIndex++;
      setTimeout(() => this.displayQuestion(sessionId, client), 1000);
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        this.cancelQuestionnaire(sessionId, client, "No response received within 30 minutes.");
      }
    });

    this.collectors.set(sessionId, collector);
  }

  /**
   * Setup timeout handlers
   */
  private static setupTimeouts(sessionId: string, client: Client): void {
    // 30-minute total timeout
    const mainTimeout = setTimeout(() => {
      this.cancelQuestionnaire(sessionId, client, "Session timed out due to inactivity.");
    }, 30 * 60 * 1000);

    this.timeouts.set(sessionId, mainTimeout);
  }

  /**
   * Clean up session data
   */
  private static cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);

    const timeout = this.timeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(sessionId);
    }

    const collector = this.collectors.get(sessionId);
    if (collector) {
      collector.stop();
      this.collectors.delete(sessionId);
    }
  }

  /**
   * Find active session for a user in a guild
   */ private static findActiveSession(userId: string, guildId: string): string | null {
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (session.userId === userId && session.guildId === guildId) {
        return sessionId;
      }
    }
    return null;
  }

  /**
   * Get session information
   */
  static getSession(sessionId: string): QuestionnaireSession | undefined {
    return this.sessions.get(sessionId);
  }
  /**
   * Get all active sessions (for debugging/admin purposes)
   */
  static getAllActiveSessions(): Map<string, QuestionnaireSession> {
    return new Map(this.sessions);
  }

  /**
   * Save questionnaire response to database
   */
  private static async saveQuestionnaireResponse(
    session: QuestionnaireSession,
    user: User
  ): Promise<void> {
    try {
      const sessionDuration = Date.now() - session.startedAt.getTime();

      // Transform session responses to database format
      const dbResponses = session.responses.map((response) => {
        const question = session.questions[response.questionIndex];
        let selectedOptionIndex: number | undefined;
        // For multiple choice questions, find the option index
        if (isMultipleChoiceQuestion(question)) {
          const answer = Array.isArray(response.answer) ? response.answer[0] : response.answer;
          selectedOptionIndex = question.options.findIndex((option) => option === answer);
          if (selectedOptionIndex === -1) {
            selectedOptionIndex = undefined;
          }
        }

        return {
          questionIndex: response.questionIndex,
          question: response.question,
          questionType: isMultipleChoiceQuestion(session.questions[response.questionIndex])
            ? ("multiple_choice" as const)
            : ("shortform" as const),
          response: Array.isArray(response.answer) ? response.answer.join(", ") : response.answer,
          selectedOptionIndex,
        };
      });

      // Create and save the questionnaire response
      const questionnaireResponse = new QuestionnaireResponseModel({
        guildId: session.guildId,
        userId: session.userId,
        username: user.username,
        questionnaireName: session.questionnaireName,
        responses: dbResponses,
        completedAt: new Date(),
        sessionDuration,
      });

      await questionnaireResponse.save();

      log.info(
        `Saved questionnaire response for ${user.username} (${user.id}) - questionnaire: ${session.questionnaireName}`
      );
    } catch (error) {
      log.error(`Failed to save questionnaire response for ${user.username} (${user.id}):`, error);
      throw error; // Re-throw to handle in calling method
    }
  }
}
