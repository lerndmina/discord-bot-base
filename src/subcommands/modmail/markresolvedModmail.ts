import { ChannelType } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import Modmail from "../../models/Modmail";
import { ThingGetter } from "../../utils/TinyUtils";
import Database from "../../utils/data/database";
import { SlashCommandProps } from "commandkit";
import log from "../../utils/log";
import FetchEnvs from "../../utils/FetchEnvs";
import { initialReply } from "../../utils/initialReply";
import { sendMessageToBothChannels, createCloseThreadButton } from "../../utils/ModmailUtils";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

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

  try {
    const db = new Database();

    // Update the modmail to mark as resolved
    await db.findOneAndUpdate(
      Modmail,
      { _id: mail._id },
      {
        markedResolved: true,
        resolvedAt: new Date(),
        // Schedule auto-close in 24 hours
        autoCloseScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: false, new: true }
    ); // Create buttons for user response
    const resolveButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("modmail_resolve_close")
        .setLabel("Close Thread")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId("modmail_resolve_continue")
        .setLabel("I Need More Help")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🆘")
    );

    // Create embed for resolution message
    const resolveEmbed = BasicEmbed(
      client,
      "✅ Issue Marked as Resolved",
      `Your support request has been marked as **resolved** by ${interaction.user.username}.\n\n` +
        `• **Click "Close Thread"** if your issue is fully resolved\n` +
        `• **Click "I Need More Help"** if you need further assistance\n` +
        `• **Send a message** if you have additional questions\n\n` +
        `This thread will automatically close in **24 hours** if no action is taken.`,
      undefined,
      "Green"
    ); // Send message to both channels - buttons only in DMs
    await sendMessageToBothChannels(client, mail, resolveEmbed, undefined, {
      dmComponents: [resolveButtons],
      threadComponents: [], // No buttons in thread
    });

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

    log.info(`Modmail ${mail._id} marked as resolved by staff member ${interaction.user.id}`);
  } catch (error) {
    log.error("Error marking modmail as resolved:", error);

    await interaction.editReply({
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
}
