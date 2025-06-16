import { ChannelType } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import Modmail from "../../models/Modmail";
import { SlashCommandProps } from "commandkit";
import log from "../../utils/log";
import FetchEnvs from "../../utils/FetchEnvs";
import { initialReply } from "../../utils/initialReply";
import { markModmailAsResolved } from "../../utils/ModmailUtils";

const env = FetchEnvs();

export default async function ({ interaction, client }: SlashCommandProps) {
  if (!interaction.channel)
    return log.error("Request made to slash command without required values - markresolved.ts");

  // Check if user has staff role
  const hasStaffRole =
    interaction.member?.roles &&
    typeof interaction.member.roles !== "string" &&
    "cache" in interaction.member.roles
      ? interaction.member.roles.cache.has(env.STAFF_ROLE)
      : false;

  if (!hasStaffRole) {
    return interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "❌ Permission Denied",
          "You need to be a staff member to use this command.",
          undefined,
          "Red"
        ),
      ],
      ephemeral: true,
    });
  }

  // Find the modmail thread
  let mail = await Modmail.findOne({ forumThreadId: interaction.channel.id });
  if (!mail && interaction.channel.type === ChannelType.DM) {
    mail = await Modmail.findOne({ userId: interaction.user.id });
  }

  if (!mail) {
    return interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "❌ Error",
          "This command can only be used in a modmail thread.",
          undefined,
          "Red"
        ),
      ],
      ephemeral: true,
    });
  }

  // Check if already marked as resolved
  if (mail.markedResolved) {
    return interaction.reply({
      embeds: [
        BasicEmbed(
          client,
          "ℹ️ Already Resolved",
          "This modmail thread has already been marked as resolved.",
          undefined,
          "Blue"
        ),
      ],
      ephemeral: true,
    });
  }
  await initialReply(interaction, true);

  // Use the centralized function to mark as resolved
  const result = await markModmailAsResolved(
    client,
    mail,
    interaction.user.username,
    interaction.user.id
  );

  if (!result.success) {
    if (result.alreadyResolved) {
      return interaction.editReply({
        embeds: [
          BasicEmbed(
            client,
            "ℹ️ Already Resolved",
            "This modmail thread has already been marked as resolved.",
            undefined,
            "Blue"
          ),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        BasicEmbed(
          client,
          "❌ Error",
          "An error occurred while marking this thread as resolved.",
          undefined,
          "Red"
        ),
      ],
    });
  }

  await interaction.editReply({
    embeds: [
      BasicEmbed(
        client,
        "✅ Thread Marked as Resolved",
        `This modmail thread has been marked as resolved.\n\n` +
          `The user has been notified and can choose to close the thread or request more help.\n` +
          `The thread will auto-close in 24 hours if no response is received.`,
        undefined,
        "Green"
      ),
    ],
  });
}
