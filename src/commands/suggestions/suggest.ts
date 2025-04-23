import type { SlashCommandProps, CommandOptions } from "commandkit";
import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  EmbedField,
} from "discord.js";
import { globalCooldownKey, setCommandCooldown, userCooldownKey, waitingEmoji } from "../../Bot";
import generateHelpFields from "../../utils/data/static/generateHelpFields";
import { initialReply } from "../../utils/initialReply";
import Database from "../../utils/data/database";
import SuggestionConfigModel, { SuggestionConfigType } from "../../models/SuggestionConfig";
import BasicEmbed from "../../utils/BasicEmbed";
import { tryCatch } from "../../utils/trycatch";
import SuggestionModel, { SuggestionStatus, SuggestionsType } from "../../models/Suggestions";
import FetchEnvs from "../../utils/FetchEnvs";
import OpenAI from "openai";
import log from "../../utils/log";

export const data = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Suggest a feature or improvement")
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: true,
  deleted: false,
};

const db = new Database();
const env = FetchEnvs();

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const suggestionConfig = await db.findOne(
    SuggestionConfigModel,
    {
      guildId: interaction.guildId!,
    },
    true
  );
  if (!suggestionConfig) {
    await interaction.reply({
      content: "",
      embeds: [BasicEmbed(client, "‼️ Error", "This server does not have suggestions enabled.")],
      ephemeral: true,
    });
    return;
  }

  // Create the modal
  const modalId = `suggestionModal-${interaction.id}`;
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle("Submit a Suggestion (Submit within 1 hour)");
  const modalTimer = 60 * 60 * 1000; // 1 hour in milliseconds

  // Create the text input components
  const suggestionInput = new TextInputBuilder()
    .setCustomId("suggestionInput")
    .setLabel("What's your suggestion?")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(20)
    .setMaxLength(1000)
    .setPlaceholder("Describe your suggestion in detail...")
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId("reasonInput")
    .setLabel("Why should we add this?")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(20)
    .setMaxLength(500)
    .setPlaceholder("Explain why this would be beneficial...")
    .setRequired(true);

  const importanceInput = new TextInputBuilder()
    .setCustomId("importanceInput")
    .setLabel("How important is this? (1-10)")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(2)
    .setPlaceholder("Enter a number between 1 and 10")
    .setRequired(true);

  // Add inputs to action rows
  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(suggestionInput);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(importanceInput);

  // Add action rows to the modal
  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

  // Present the modal to the user
  await interaction.showModal(modal);

  // Wait for the modal submission
  const filter = (i: ModalSubmitInteraction) => i.customId === modalId;
  try {
    const modalSubmit = await interaction.awaitModalSubmit({
      filter,
      time: 60 * 60 * 1000,
    });

    // Get the data entered by the user
    const suggestion = modalSubmit.fields.getTextInputValue("suggestionInput");
    const reason = modalSubmit.fields.getTextInputValue("reasonInput");
    const importance = modalSubmit.fields.getTextInputValue("importanceInput");

    // Validate importance is between 1 and 10
    const importanceNum = parseInt(importance);
    if (isNaN(importanceNum) || importanceNum < 0 || importanceNum > 10) {
      await modalSubmit.reply({
        content: "Please provide a valid importance rating between 1 and 10.",
        ephemeral: true,
      });
      return;
    }

    await submitSuggestion(modalSubmit, suggestion, reason, importanceNum, suggestionConfig);
  } catch (error) {
    // If the user didn't submit the modal in time
    console.error("Modal timeout or error:", error);
    // No need to reply as the modal probably timed out
  }
}

async function submitSuggestion(
  interaction: ModalSubmitInteraction,
  suggestion: string,
  reason: string,
  importance: number,
  suggestionConfig: SuggestionConfigType
) {
  await initialReply(interaction, true);

  try {
    const title = await getSuggestionTitle(suggestion, reason);

    // Create a new suggestion document - Mongoose will handle the ID generation
    const newSuggestion = new SuggestionModel({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: suggestionConfig.channelId,
      suggestion,
      reason,
      importance,
      title,
      status: SuggestionStatus.Pending,
    });

    // Save the suggestion to the database
    const savedSuggestion = await db.findOneAndUpdate(
      SuggestionModel,
      { id: newSuggestion.id },
      newSuggestion,
      {
        upsert: true,
        new: true,
      }
    );

    if (!savedSuggestion || !savedSuggestion.id) {
      log.error("Failed to generate ID for suggestion");
      await interaction.editReply({
        content: "There was an error saving your suggestion. Please try again later.",
      });
      return;
    }

    log.info(`New suggestion created with ID: ${savedSuggestion.id}`);

    // Send message to the suggestions channel
    const suggestionsChannel = await interaction.client.channels.fetch(suggestionConfig.channelId);

    if (suggestionsChannel && suggestionsChannel.isTextBased()) {
      const suggestionEmbed = getSuggestionEmbed(interaction, savedSuggestion);

      const row = getSuggestionButtons(0, 0, savedSuggestion); // Initialize with 0 upvotes and downvotes

      const suggestionMessage = await suggestionsChannel.send({
        embeds: [suggestionEmbed],
        components: [row],
      });

      // Update the suggestion with the message ID
      savedSuggestion.messageLink = suggestionMessage.url;
      await db.findOneAndUpdate(SuggestionModel, { id: savedSuggestion.id }, savedSuggestion, {
        upsert: true,
        new: true,
      });
    }

    // Reply to the user
    await interaction.editReply({
      content: `Thank you! Your suggestion has been submitted with ID #${savedSuggestion.id}.`,
    });

    // Set cooldown
    setCommandCooldown(userCooldownKey(interaction.user.id, "suggest"), 60 * 60); // 1 hour cooldown in seconds
  } catch (error) {
    console.error("Error submitting suggestion:", error);
    await interaction.editReply({
      content: "There was an error submitting your suggestion. Please try again later.",
    });
  }
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

async function getSuggestionTitle(suggestion: string, reason?: string): Promise<string> {
  // !!! DISABLED FOR NOW !!!
  return "A User Suggestion Title"; // Fallback title

  // try {
  //   const conversation = [
  //     {
  //       role: "system",
  //       content:
  //         "You are a title generating service. You will be provided with a suggestion and you will generate a short title for it 20-50 characters.",
  //     },
  //   ];
  //   conversation.push({
  //     role: "user",
  //     content: suggestion,
  //   });
  //   if (reason) {
  //     conversation.push({
  //       role: "user",
  //       content: `The reason for this suggestion is: ${reason}`,
  //     });
  //   }
  //   const response = await openai.chat.completions.create({
  //     model: "gpt-4.1-nano",
  //     messages: conversation as any,
  //     max_tokens: 50, // limit token usage
  //     temperature: 0.5,
  //   });

  //   if (!response || !response.choices[0] || !response.choices[0].message.content) {
  //     return "Untitled Suggestion";
  //   }
  //   return response.choices[0].message.content.trim();
  // } catch (error) {
  //   return "Untitled Suggestion"; // Fallback title in case of error
  // }
}

export function getSuggestionButtons(
  upvotes: number,
  downvotes: number,
  savedSuggestion: SuggestionsType
) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest-upvote-${savedSuggestion.id}`)
      .setLabel(`Upvote (${upvotes})`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(savedSuggestion.status !== SuggestionStatus.Pending)
      .setEmoji("👍"),
    new ButtonBuilder()
      .setCustomId(`suggest-downvote-${savedSuggestion.id}`)
      .setLabel(`Downvote (${downvotes})`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(savedSuggestion.status !== SuggestionStatus.Pending)
      .setEmoji("👎"),
    new ButtonBuilder()
      .setCustomId(`suggest-manage-${savedSuggestion.id}`)
      .setLabel("Manage")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⚙️")
  );
  return row;
}

export function getSuggestionEmbed(interaction: Interaction, savedSuggestion: SuggestionsType) {
  const embedColour =
    savedSuggestion.status === SuggestionStatus.Pending
      ? "Blue"
      : savedSuggestion.status === SuggestionStatus.Approved
      ? "Green"
      : "Red";
  const embedEmoji =
    savedSuggestion.status === SuggestionStatus.Pending
      ? "⏳"
      : savedSuggestion.status === SuggestionStatus.Approved
      ? "✅"
      : "❌";

  const fields: EmbedField[] = [
    { name: "Suggestion (Your suggestion)", value: savedSuggestion.suggestion, inline: false },
    { name: "Reason (Why we should add this)", value: savedSuggestion.reason, inline: false },
    { name: "Submitted by", value: `<@${interaction.user.id}>`, inline: true },
    { name: "Created ", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    { name: "Status", value: savedSuggestion.status, inline: true },
  ];

  if (savedSuggestion.status !== SuggestionStatus.Pending) {
    fields.push({
      name: savedSuggestion.status === SuggestionStatus.Approved ? "Approved by" : "Denied by",
      value: `<@${savedSuggestion.managedBy}>`,
      inline: true,
    });
  }

  return BasicEmbed(
    interaction.client,
    `${embedEmoji} - ${savedSuggestion.title}`,
    ``,
    fields,
    savedSuggestion.status === SuggestionStatus.Pending
      ? "Blue"
      : savedSuggestion.status === SuggestionStatus.Approved
      ? "Green"
      : "Red"
  );
}
