import type { SlashCommandProps, CommandOptions } from "commandkit";
import { SlashCommandBuilder } from "discord.js";
import { setCommandCooldown, userCooldownKey, waitingEmoji } from "../../Bot";

export const data = new SlashCommandBuilder()
  .setName("therules")
  .setDescription("Tell someone to read the rules.")
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  await interaction.reply({ content: waitingEmoji, ephemeral: false });
  setCommandCooldown(userCooldownKey(interaction.user.id, interaction.commandName), 30);

  interaction.editReply("https://therules.fyi/");
}
