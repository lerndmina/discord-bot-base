import {
  SlashCommandBuilder,
  CommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { SlashCommandProps, CommandOptions } from "commandkit";
import QuestionnaireService from "../../services/QuestionnaireService";
import QuestionnaireRunner from "../../services/QuestionnaireRunner";
import BasicEmbed from "../../utils/BasicEmbed";
import log from "../../utils/log";

export const data = new SlashCommandBuilder()
  .setName("questionnaire")
  .setDescription("Start an interactive questionnaire")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("The name of the questionnaire to start")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const options: CommandOptions = {
  userPermissions: ["ManageGuild"],
  deleted: false,
  devOnly: false,
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Error",
          "This command can only be used within a server.",
          undefined,
          "Red"
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const questionnaireName = interaction.options.getString("name", true);

  try {
    // Fetch the questionnaire from the database
    const questionnaireService = new QuestionnaireService();
    const questionnaire = await questionnaireService.getQuestionnaire(
      interaction.guild.id,
      questionnaireName
    );

    if (!questionnaire) {
      await interaction.reply({
        embeds: [
          BasicEmbed(
            client,
            "Questionnaire Not Found",
            `No questionnaire named "${questionnaireName}" was found for this server.`,
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (!questionnaire.questions || questionnaire.questions.length === 0) {
      await interaction.reply({
        embeds: [
          BasicEmbed(
            client,
            "Empty Questionnaire",
            `The questionnaire "${questionnaireName}" has no questions.`,
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Starting Questionnaire",
          `I'll send the "${questionnaire.name}" questionnaire to your DMs. Please check your direct messages to begin.`,
          undefined,
          "Green"
        ),
      ],
      ephemeral: true,
    });

    // Create DM channel and start the questionnaire session there
    const dmChannel = await interaction.user.createDM();
    const sessionId = await QuestionnaireRunner.startQuestionnaire(
      questionnaire,
      interaction.user,
      interaction.guild,
      dmChannel,
      client
    );

    if (!sessionId) {
      await interaction.followUp({
        embeds: [
          BasicEmbed(
            client,
            "Could Not Start",
            "Failed to start the questionnaire. You may already have an active session or I cannot send you DMs. Please make sure your DMs are open and try again.",
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
    }
  } catch (error) {
    log.error("Error starting questionnaire:", error);
    if (error instanceof Error && error.message.includes("Cannot send messages to this user")) {
      await interaction.followUp({
        embeds: [
          BasicEmbed(
            client,
            "DM Error",
            "I cannot send you direct messages. Please enable DMs from server members and try again.",
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
    } else {
      await interaction.followUp({
        embeds: [
          BasicEmbed(
            client,
            "Error",
            "An error occurred while starting the questionnaire. Please try again later.",
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
    }
  }
}
