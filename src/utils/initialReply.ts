import {
  CommandInteraction,
  Interaction,
  InteractionType,
  MessageComponentInteraction,
} from "discord.js";
import { waitingEmoji } from "../Bot";

export async function initialReply(
  interaction: Interaction | MessageComponentInteraction,
  ephemeral = false
) {
  if (interaction.type === InteractionType.ApplicationCommandAutocomplete)
    throw new Error("Autocomplete interaction is not supported for initial reply");
  return await interaction.reply({
    content: waitingEmoji,
    ephemeral,
  });
}
