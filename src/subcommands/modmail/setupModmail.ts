import { SlashCommandBuilder, EmbedBuilder, userMention, ForumChannel } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import ModmailConfig from "../../models/ModmailConfig";
import { CommandOptions, SlashCommandProps } from "commandkit";
import { waitingEmoji } from "../../Bot";
import { initialReply } from "../../utils/initialReply";

export const setupModmailOptions: CommandOptions = {
  devOnly: false,
  deleted: true,
  userPermissions: ["ManageChannels", "ManageGuild", "ManageThreads"],
  botPermissions: ["ManageWebhooks", "ManageChannels", "ManageThreads"],
};

export default async function ({ interaction, client, handler }: SlashCommandProps) {
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

  await initialReply(interaction, true);

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
