import {
  ButtonInteraction,
  Client,
  InteractionType,
  MessageComponentInteraction,
} from "discord.js";
import FetchEnvs, { DEFAULT_OPTIONAL_STRING } from "../../utils/FetchEnvs";
import { FivemReportMessageActions } from "../../types/FivemTypes";

const env = FetchEnvs();

if (env.ENABLE_FIVEM_SYSTEMS && env.FIVEM_MYSQL_URI !== DEFAULT_OPTIONAL_STRING) {
  module.exports = {
    default: async (interaction: ButtonInteraction, client: Client) => {
      if (!interaction.guild) return;
      if (interaction.user.bot) return;
      if (interaction.type !== InteractionType.MessageComponent) return;
      if (!interaction.customId || !interaction.customId.startsWith("fivem-report-")) return;
      const ticketId = interaction.customId.split(":")[1];
      const action = interaction.customId.split("-")[2] as FivemReportMessageActions;

      console.log(`[FivemButtonListener]`, {
        info: "Button interaction detected",
        interactionUser: interaction.user.username,
        ticketId: ticketId,
        action: action,
      });
    },
  };
}
