import type { SlashCommandProps, CommandOptions } from "commandkit";
import { SlashCommandBuilder } from "discord.js";
import { globalCooldownKey, setCommandCooldown, waitingEmoji } from "../../Bot";
import generateHelpFields from "../../utils/data/static/generateHelpFields";

export const data = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("This is a template command.")
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: true,
  deleted: false,
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  await interaction.reply({ content: waitingEmoji, ephemeral: true });
  setCommandCooldown(globalCooldownKey(interaction.commandName), 600);

  interaction.editReply({ content: "Loading spinner complete" });
}
