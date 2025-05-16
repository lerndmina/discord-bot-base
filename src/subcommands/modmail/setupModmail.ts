import { SlashCommandBuilder, EmbedBuilder, userMention, ForumChannel } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import ModmailConfig from "../../models/ModmailConfig";
import { CommandOptions, SlashCommandProps } from "commandkit";
import { waitingEmoji } from "../../Bot";
import { initialReply } from "../../utils/initialReply";
import Database from "../../utils/data/database";
import FetchEnvs from "../../utils/FetchEnvs";
import log from "../../utils/log";

export const setupModmailOptions: CommandOptions = {
  devOnly: false,
  deleted: false,
  userPermissions: ["ManageGuild"],
};

export default async function setupModmail({ interaction, client, handler }: SlashCommandProps) {
  await interaction.reply(waitingEmoji);
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const description = interaction.options.getString("description");
  if (!channel || !role) {
    return interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(
          client,
          "Error",
          "You must provide a channel and role to setup modmail.",
          undefined,
          "Red"
        ),
      ],
    });
  }
  if (channel.type !== 15) {
    return interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(client, "Error", "The channel must be a forum channel.", undefined, "Red"),
      ],
    });
  }
  const forumChannel = channel as ForumChannel;

  if (description && description.length > 60) {
    return interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(
          client,
          "Error",
          "The description must be 60 characters or less.",
          undefined,
          "Red"
        ),
      ],
    });
  }

  try {
    // Create a webhook for the server
    const webhook = await forumChannel.createWebhook({
      name: "Modmail System",
      avatar: client.user.displayAvatarURL(),
      reason: "Modmail system webhook for relaying user messages",
    });

    const db = new Database();
    await db.findOneAndUpdate(
      ModmailConfig,
      { guildId: interaction.guild?.id },
      {
        guildId: interaction.guild?.id,
        guildDescription: description || undefined,
        forumChannelId: forumChannel.id,
        staffRoleId: role.id,
        webhookId: webhook.id,
        webhookToken: webhook.token,
      },
      { upsert: true, new: true }
    );

    interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(
          client,
          "Success",
          `Modmail has been setup successfully! The forum channel ${forumChannel} will be used for modmail threads and the role ${role} will be pinged when a new thread is created.${
            description ? `\n\nDescription: ${description}` : ""
          }`,
          undefined,
          "Green"
        ),
      ],
    });
  } catch (error) {
    log.error("Error setting up modmail:", error);
    interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(
          client,
          "Error",
          `An error occurred while setting up modmail: ${error}`,
          undefined,
          "Red"
        ),
      ],
    });
  }
}
