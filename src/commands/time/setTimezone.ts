import type { CommandData, SlashCommandProps, CommandOptions, AutocompleteProps } from "commandkit";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationCommand,
  AutocompleteInteraction,
} from "discord.js";
import UserTimezone from "../../models/UserTimezone";
import Database from "../../utils/data/database";
import moment from "moment-timezone";

export const data = new SlashCommandBuilder()
  .setName("settimezone")
  .setDescription("Sets your timezone in the bot!")
  .addStringOption((option) =>
    option
      .setName("timezone")
      .setDescription("Your timezone")
      .setRequired(true)
      .setAutocomplete(true)
  );

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};

const TIMEZONE_NAMES = moment.tz.names();

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const timezone = interaction.options.getString("timezone");
  if (!timezone) {
    await interaction.reply({ content: "You need to enter a timezone!", ephemeral: true });
    return;
  }
  if (!TIMEZONE_NAMES.includes(timezone)) {
    await interaction.reply({ content: "You sent an invalid timezone!", ephemeral: true });
    return;
  }

  const user = interaction.user;
  const userId = user.id;

  const db = new Database();
  await db.findOneAndUpdate(UserTimezone, { userId }, { timezone });

  const postEmbed = new EmbedBuilder()
    .setTitle("Timezone Set")
    .setDescription(`Your timezone has been set to \`${timezone}\``)
    .setColor("#0099ff");

  await interaction.reply({ embeds: [postEmbed], ephemeral: true });
}

export async function autocomplete({ interaction, client, handler }: AutocompleteProps) {
  const focusedTzOption = interaction.options.getFocused(true).value.toLowerCase();
  const filteredChoices = TIMEZONE_NAMES.filter((tz) => tz.toLowerCase().includes(focusedTzOption));
  const choices = filteredChoices.map((tz) => ({ name: tz, value: tz }));
  interaction.respond(choices.slice(0, 25));
}
