import type { SlashCommandProps, CommandOptions } from "commandkit";
import { SlashCommandBuilder } from "discord.js";
import { ThingGetter } from "../../utils/TinyUtils";

export const data = new SlashCommandBuilder()
  .setName("modmailban")
  .setDescription("Bans a user from using modmail for a duration")
  .addUserOption((option) => option.setName("user").setDescription("user to ban").setRequired(true))
  .addStringOption((option) =>
    option
      .setName("duration")
      .setDescription("The duration to ban the user for (e.g. 1d, 1w, 1m)")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("reason").setDescription("The reason for the ban").setRequired(true)
  )
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: true,
  deleted: false,
  userPermissions: ["ManageMessages", "KickMembers", "BanMembers"], // This is a mod command
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const guild = interaction.guild;
  const user = interaction.options.getUser("user");
  const duration = interaction.options.getString("duration");
  const reason = interaction.options.getString("reason");
  const getter = new ThingGetter(client);

  if (!user || !duration || !guild || !reason)
    return interaction.reply(
      `Invalid arguments, missing ${
        !user ? "user" : !duration ? "duration" : !reason ? "reason" : "guild"
      }`
    );
}
