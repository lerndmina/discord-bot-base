import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";
import { SlashCommandProps, CommandOptions } from "commandkit";
import QuestionnaireBuilder from "../../services/QuestionnaireBuilder";
import BasicEmbed from "../../utils/BasicEmbed";
import log from "../../utils/log";

export const data = new SlashCommandBuilder()
  .setName("create-questionnaire")
  .setDescription("Create a new questionnaire using examples")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("The type of questionnaire to create")
      .setRequired(true)
      .addChoices(
        { name: "Feedback Survey", value: "feedback" },
        { name: "User Application", value: "application" },
        { name: "Event Feedback", value: "event" },
        { name: "Custom", value: "custom" }
      )
  )
  .addStringOption((option) =>
    option.setName("name").setDescription("The name of the questionnaire").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const options: CommandOptions = {
  userPermissions: ["ManageGuild"],
  deleted: false,
  devOnly: true,
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [
        BasicEmbed(client, "Error", "This command can only be used in a server.", undefined, "Red"),
      ],
      ephemeral: true,
    });
    return;
  }

  const questionnaireType = interaction.options.getString("type", true);
  const questionnaireName = interaction.options.getString("name", true);

  try {
    let builder = new QuestionnaireBuilder(interaction.guild.id, questionnaireName);

    // Create different questionnaire templates based on type
    switch (questionnaireType) {
      case "feedback":
        builder = builder
          .setDescription("Help us improve by providing your feedback")
          .addMultipleChoice("How satisfied are you with our service?", [
            "Very satisfied",
            "Satisfied",
            "Neutral",
            "Dissatisfied",
            "Very dissatisfied",
          ])
          .addShortForm(
            "What did you like most about your experience?",
            "Tell us what you enjoyed..."
          )
          .addShortForm("What can we improve?", "Share your suggestions for improvement...")
          .addMultipleChoice("Would you recommend us to others?", ["Yes", "No", "Maybe"]);
        break;

      case "application":
        builder = builder
          .setDescription("Application form for joining our community")
          .addShortForm("What is your full name?", "Enter your full name")
          .addShortForm("How old are you?", "Enter your age")
          .addShortForm("Tell us about yourself", "Share a brief introduction...")
          .addMultipleChoice("How did you hear about us?", [
            "Friend referral",
            "Social media",
            "Search engine",
            "Discord server",
            "Other",
          ])
          .addShortForm("Why do you want to join our community?", "Explain your motivation...");
        break;

      case "event":
        builder = builder
          .setDescription("Event feedback survey")
          .addMultipleChoice("How would you rate the event overall?", [
            "Excellent",
            "Good",
            "Average",
            "Poor",
            "Very poor",
          ])
          .addMultipleChoice("How was the event organization?", [
            "Very well organized",
            "Well organized",
            "Average",
            "Poorly organized",
            "Very poorly organized",
          ])
          .addShortForm(
            "What was your favorite part of the event?",
            "Tell us what you enjoyed most..."
          )
          .addShortForm("What could be improved for future events?", "Share your suggestions...")
          .addMultipleChoice("Would you attend similar events in the future?", [
            "Yes",
            "No",
            "Maybe",
          ]);
        break;

      case "custom":
        builder = builder
          .setDescription("Custom questionnaire - modify as needed")
          .addShortForm("Sample text question", "Enter your response here...")
          .addMultipleChoice("Sample multiple choice question", [
            "Option 1",
            "Option 2",
            "Option 3",
          ]);
        break;

      default:
        throw new Error("Invalid questionnaire type");
    }

    // Build and save the questionnaire
    const questionnaire = await builder.build();

    await interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Questionnaire Created",
          `Successfully created the "${questionnaireName}" questionnaire!`,
          [
            {
              name: "Type",
              value: questionnaireType,
              inline: true,
            },
            {
              name: "Questions",
              value: questionnaire.questions.length.toString(),
              inline: true,
            },
            {
              name: "Usage",
              value: `Use \`/questionnaire name:${questionnaireName}\` to start it`,
              inline: false,
            },
          ],
          "Green"
        ),
      ],
      ephemeral: true,
    });

    log.info(
      `Questionnaire "${questionnaireName}" created by ${interaction.user.username} in guild ${interaction.guild.id}`
    );
  } catch (error) {
    log.error("Error creating questionnaire:", error);
    await interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "Error",
          `Failed to create questionnaire: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          undefined,
          "Red"
        ),
      ],
      ephemeral: true,
    });
  }
}
