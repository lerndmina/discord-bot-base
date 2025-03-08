import { SlashCommandBuilder, EmbedBuilder, userMention, ForumChannel } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import ModmailConfig from "../../models/ModmailConfig";
import { CommandOptions, SlashCommandProps } from "commandkit";
import { waitingEmoji } from "../../Bot";

export const data = new SlashCommandBuilder()
  .setName("setupmodmail")
  .setDMPermission(false)
  .setDescription("Setup modail for this discord server.")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The forum channel to put the modmail channels in.")
      .setRequired(true)
  )
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("The role to ping when a new modmail is created.")
      .setRequired(true)
  );

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
  userPermissions: ["ManageChannels", "ManageGuild", "ManageThreads"],
  botPermissions: ["ManageWebhooks", "ManageChannels", "ManageThreads"],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const channel = interaction.options.getChannel("channel")!;
  const role = interaction.options.getRole("role")!;
  if (!(channel instanceof ForumChannel)) {
    return interaction.reply({
      embeds: [
        BasicEmbed(client, "‼️ Error", "The channel must be a forum channel.", undefined, "Red"),
      ],
      ephemeral: true,
    });
  }

  await interaction.reply({ content: waitingEmoji, ephemeral: true });

  if (!interaction.guild)
    return interaction.editReply("‼️ Error, somehow this command was ran in a DM?");

  try {
    const modmailConfig = await ModmailConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      {
        guildId: interaction.guild.id,
        forumChannelId: channel.id,
        staffRoleId: role.id,
      },
      {
        upsert: true,
        new: true,
      }
    );
  } catch (error) {
    return interaction.editReply({
      content: "<:yikes:950428967301709885>",
    });
  }

  interaction.editReply("🎉 Successfully created modmail config entry!");
}
