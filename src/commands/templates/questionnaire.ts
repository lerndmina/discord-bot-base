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
  if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Error",
          "This command can only be used in a text channel within a server.",
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
          `Starting the "${questionnaire.name}" questionnaire...`,
          undefined,
          "Green"
        ),
      ],
      ephemeral: true,
    });

    // Start the questionnaire session
    const sessionId = await QuestionnaireRunner.startQuestionnaire(
      questionnaire,
      interaction.user,
      interaction.guild,
      interaction.channel,
      client
    );

    if (!sessionId) {
      await interaction.followUp({
        embeds: [
          BasicEmbed(
            client,
            "Could Not Start",
            "Failed to start the questionnaire. You may already have an active session.",
            undefined,
            "Red"
          ),
        ],
        ephemeral: true,
      });
    }
  } catch (error) {
    log.error("Error starting questionnaire:", error);
    await interaction.reply({
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
