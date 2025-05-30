import {
  Client,
  Interaction,
  InteractionType,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import QuestionnaireRunner from "../../services/QuestionnaireRunner";
import log from "../../utils/log";

/**
 * Handles all questionnaire-related interactions
 */
export default async (interaction: Interaction, client: Client<true>) => {
  try {
    // Only handle component and modal submit interactions
    if (
      interaction.type !== InteractionType.MessageComponent &&
      interaction.type !== InteractionType.ModalSubmit
    ) {
      return false;
    }

    // Check if this is a questionnaire interaction
    if (!interaction.customId?.startsWith("questionnaire:")) {
      return false;
    }

    let handled = false;

    // Route to appropriate handler based on interaction type
    if (interaction.type === InteractionType.MessageComponent) {
      if (interaction.isButton()) {
        handled = await QuestionnaireRunner.handleButtonInteraction(
          interaction as ButtonInteraction,
          client
        );
      } else if (interaction.isStringSelectMenu()) {
        handled = await QuestionnaireRunner.handleSelectMenuInteraction(
          interaction as StringSelectMenuInteraction,
          client
        );
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      handled = await QuestionnaireRunner.handleModalSubmit(
        interaction as ModalSubmitInteraction,
        client
      );
    }

    return handled;
  } catch (error) {
    log.error("Error handling questionnaire interaction:", error);

    // Try to respond to the interaction if we haven't already
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "An error occurred while processing your questionnaire response. Please try again.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      log.error("Error sending error response:", replyError);
    }

    return true; // We handled it, even if there was an error
  }
};
