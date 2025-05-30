import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Message,
  User,
  Guild,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import {
  Question,
  QuestionType,
  MultipleChoiceQuestion,
  StringQuestion,
  isMultipleChoiceQuestion,
  isStringQuestion,
} from "../models/Questionnaire";
import BasicEmbed from "../utils/BasicEmbed";
import log from "../utils/log";

export interface QuestionnaireResponse {
  questionIndex: number;
  question: string;
  answer: string | string[];
  timestamp: Date;
}

export interface QuestionnaireSession {
  userId: string;
  guildId: string;
  questionnaireName: string;
  questions: Question[];
  currentQuestionIndex: number;
  responses: QuestionnaireResponse[];
  startedAt: Date;
  lastActivityAt: Date;
  messageId?: string;
  channelId: string;
  isProcessingResponse?: boolean;
  completedQuestions: Set<number>;
  isCompleting?: boolean;
}

/**
 * Handles individual question interactions and response collection
 */
export class QuestionInteractionHandler {
  private static readonly TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private static readonly REMINDER_INTERVALS = [10 * 60 * 1000, 20 * 60 * 1000]; // 10 and 20 minutes

  /**
   * Creates interaction components for a multiple choice question
   */
  static createMultipleChoiceComponents(
    question: MultipleChoiceQuestion,
    questionIndex: number,
    sessionId: string,
    allowMultiple: boolean = false
  ): ActionRowBuilder[] {
    const components: ActionRowBuilder[] = [];
    const { options } = question;

    // If 5 or fewer options, use buttons. Otherwise use dropdown
    if (options.length <= 5) {
      const buttonRow = new ActionRowBuilder<ButtonBuilder>();

      options.forEach((option, index) => {
        const button = new ButtonBuilder()
          .setCustomId(
            `questionnaire:${sessionId}:mc:${questionIndex}:${index}:${
              allowMultiple ? "multi" : "single"
            }`
          )
          .setLabel(option.length > 80 ? option.substring(0, 77) + "..." : option)
          .setStyle(ButtonStyle.Primary);

        buttonRow.addComponents(button);
      });

      components.push(buttonRow);

      // Add submit button for multiple choice if allowing multiple selections
      if (allowMultiple) {
        const submitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`questionnaire:${sessionId}:submit:${questionIndex}`)
            .setLabel("Submit Selected Answers")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")
        );
        components.push(submitRow);
      }
    } else {
      // Use dropdown for many options
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(
          `questionnaire:${sessionId}:select:${questionIndex}:${allowMultiple ? "multi" : "single"}`
        )
        .setPlaceholder("Choose your answer...")
        .setMinValues(1)
        .setMaxValues(allowMultiple ? Math.min(options.length, 25) : 1);

      options.forEach((option, index) => {
        selectMenu.addOptions({
          label: option.length > 100 ? option.substring(0, 97) + "..." : option,
          value: index.toString(),
          description: option.length > 100 ? option : undefined,
        });
      });

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      components.push(selectRow as any);
    }

    // Add navigation buttons
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:prev:${questionIndex}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
        .setDisabled(questionIndex === 0),
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:skip:${questionIndex}`)
        .setLabel("Skip Question")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏭️"),
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:cancel`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    components.push(navRow);

    return components;
  }

  /**
   * Creates interaction components for a short form question
   */
  static createShortFormComponents(
    question: StringQuestion,
    questionIndex: number,
    sessionId: string
  ): ActionRowBuilder[] {
    const components: ActionRowBuilder[] = [];

    // Modal button for immediate input
    const modalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:modal:${questionIndex}`)
        .setLabel("Answer in Popup")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:message:${questionIndex}`)
        .setLabel("Type Your Response")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("💬")
    );

    components.push(modalRow);

    // Navigation buttons
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:prev:${questionIndex}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
        .setDisabled(questionIndex === 0),
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:skip:${questionIndex}`)
        .setLabel("Skip Question")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏭️"),
      new ButtonBuilder()
        .setCustomId(`questionnaire:${sessionId}:cancel`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    components.push(navRow);

    return components;
  }

  /**
   * Creates a modal for text input
   */
  static createTextInputModal(
    question: StringQuestion,
    questionIndex: number,
    sessionId: string
  ): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(`questionnaire:${sessionId}:modal_submit:${questionIndex}`)
      .setTitle(`Question ${questionIndex + 1}`);

    const textInput = new TextInputBuilder()
      .setCustomId("response")
      .setLabel(
        question.question.length > 45
          ? question.question.substring(0, 42) + "..."
          : question.question
      )
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(question.placeholder || "Enter your response here...")
      .setMaxLength(4000)
      .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
    modal.addComponents(actionRow);

    return modal;
  }

  /**
   * Creates an embed for displaying a question
   */
  static createQuestionEmbed(
    question: Question,
    questionIndex: number,
    totalQuestions: number,
    questionnaireName: string,
    user: User
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${questionnaireName} - Question ${questionIndex + 1}/${totalQuestions}`)
      .setDescription(question.question)
      .setColor(0x3498db)
      .setFooter({
        text: `Answering for ${user.username}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();

    if (isMultipleChoiceQuestion(question)) {
      const optionsText = question.options
        .map((option, index) => `${index + 1}. ${option}`)
        .join("\n");

      embed.addFields({
        name: "Options",
        value: optionsText.length > 1024 ? optionsText.substring(0, 1021) + "..." : optionsText,
        inline: false,
      });
    } else if (isStringQuestion(question)) {
      if (question.placeholder) {
        embed.addFields({
          name: "Hint",
          value: question.placeholder,
          inline: false,
        });
      }
    }

    return embed;
  }

  /**
   * Creates a progress embed showing questionnaire completion status
   */
  static createProgressEmbed(session: QuestionnaireSession, user: User): EmbedBuilder {
    const progress = (session.responses.length / session.questions.length) * 100;
    const progressBar = this.createProgressBar(progress);

    return new EmbedBuilder()
      .setTitle(`${session.questionnaireName} Progress`)
      .setDescription(
        `**Progress:** ${progressBar} ${progress.toFixed(1)}%\n\n**Completed:** ${
          session.responses.length
        }/${session.questions.length} questions`
      )
      .setColor(0x2ecc71)
      .setFooter({
        text: `${user.username}'s Progress`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();
  }

  /**
   * Creates a completion embed when questionnaire is finished
   */
  static createCompletionEmbed(session: QuestionnaireSession, user: User): EmbedBuilder {
    const duration = Date.now() - session.startedAt.getTime();
    const durationMinutes = Math.floor(duration / 60000);

    return new EmbedBuilder()
      .setTitle(`🎉 Questionnaire Complete!`)
      .setDescription(`Thank you for completing **${session.questionnaireName}**!`)
      .addFields(
        { name: "Questions Answered", value: session.responses.length.toString(), inline: true },
        { name: "Time Taken", value: `${durationMinutes} minute(s)`, inline: true },
        { name: "Completion Rate", value: "100%", inline: true }
      )
      .setColor(0x27ae60)
      .setFooter({
        text: `Completed by ${user.username}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();
  }

  /**
   * Creates a visual progress bar
   */
  private static createProgressBar(percentage: number): string {
    const total = 20;
    const filled = Math.round((percentage / 100) * total);
    const empty = total - filled;

    return "█".repeat(filled) + "░".repeat(empty);
  }

  /**
   * Creates a timeout warning embed
   */
  static createTimeoutWarningEmbed(timeRemaining: number, user: User): EmbedBuilder {
    const minutes = Math.floor(timeRemaining / 60000);

    return new EmbedBuilder()
      .setTitle("⏰ Questionnaire Timeout Warning")
      .setDescription(`You have **${minutes} minute(s)** remaining to complete this questionnaire.`)
      .setColor(0xf39c12)
      .setFooter({
        text: `${user.username}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();
  }

  /**
   * Creates a timeout embed when questionnaire expires
   */
  static createTimeoutEmbed(session: QuestionnaireSession, user: User): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle("⏰ Questionnaire Timed Out")
      .setDescription(
        `Your questionnaire session for **${session.questionnaireName}** has expired due to inactivity.`
      )
      .addFields(
        {
          name: "Progress Lost",
          value: `${session.responses.length}/${session.questions.length} questions answered`,
          inline: true,
        },
        {
          name: "Restart",
          value: "You can start a new questionnaire session anytime.",
          inline: true,
        }
      )
      .setColor(0xe74c3c)
      .setFooter({
        text: `${user.username}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();
  }
}
