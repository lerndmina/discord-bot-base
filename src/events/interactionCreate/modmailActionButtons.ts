import {
  ButtonInteraction,
  ChannelType,
  Client,
  InteractionType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import Database from "../../utils/data/database";
import Modmail, { ModmailType } from "../../models/Modmail";
import ModmailConfig from "../../models/ModmailConfig";
import { ThingGetter } from "../../utils/TinyUtils";
import { handleTag } from "../messageCreate/gotMail";
import FetchEnvs from "../../utils/FetchEnvs";
import log from "../../utils/log";
import { sendModmailCloseMessage, sendMessageToBothChannels } from "../../utils/ModmailUtils";
import BasicEmbed from "../../utils/BasicEmbed";
import { ButtonBuilder, ButtonStyle } from "discord.js";

const env = FetchEnvs();

// Extended types that include MongoDB document fields
type ModmailDoc = ModmailType & { _id: string; createdAt?: Date; updatedAt?: Date };

export default async (interaction: ButtonInteraction, client: Client<true>) => {
  if (interaction.type !== InteractionType.MessageComponent) return false;
  if (!interaction.isButton()) return false;

  const customId = interaction.customId;
  if (!customId.startsWith("modmail_")) return false;

  // Handle existing modmail resolve and claim buttons
  if (customId.startsWith("modmail_resolve_") || customId === "modmail_claim") {
    return false; // Let the existing handler handle these
  }

  const db = new Database();
  const getter = new ThingGetter(client);

  try {
    // Find modmail by thread ID (these buttons are only in threads)
    let modmail: ModmailDoc | null = null;
    if (interaction.channel?.isThread()) {
      modmail = (await db.findOne(Modmail, {
        forumThreadId: interaction.channel.id,
      })) as ModmailDoc;
    }

    if (!modmail) {
      await interaction.reply({
        content: "❌ Could not find an associated modmail thread.",
        ephemeral: true,
      });
      return true;
    }

    // Check if user has staff role for all actions
    const hasStaffRole =
      interaction.member?.roles &&
      typeof interaction.member.roles !== "string" &&
      "cache" in interaction.member.roles
        ? interaction.member.roles.cache.has(env.STAFF_ROLE)
        : false;

    if (!hasStaffRole) {
      await interaction.reply({
        content: "❌ You need to be a staff member to use these modmail actions.",
        ephemeral: true,
      });
      return true;
    }

    switch (customId) {
      case "modmail_mark_resolved":
        return await handleMarkResolved(interaction, client, modmail, db);

      case "modmail_close_with_reason":
        return await handleCloseWithReason(interaction, modmail);

      case "modmail_ban_user":
        return await handleBanUser(interaction, modmail);

      default:
        return false;
    }
  } catch (error) {
    log.error("Error in modmail action button handler:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred while processing your request.",
        ephemeral: true,
      });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: "❌ An error occurred while processing your request.",
      });
    }

    return true;
  }
};

/**
 * Handle mark resolved button
 */
async function handleMarkResolved(
  interaction: ButtonInteraction,
  client: Client<true>,
  modmail: ModmailDoc,
  db: Database
): Promise<boolean> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Check if already marked as resolved
    if (modmail.markedResolved) {
      await interaction.editReply({
        content: "ℹ️ This modmail thread has already been marked as resolved.",
      });
      return true;
    }

    // Update the modmail to mark as resolved
    await db.findOneAndUpdate(
      Modmail,
      { _id: modmail._id },
      {
        markedResolved: true,
        resolvedAt: new Date(),
        // Schedule auto-close in 24 hours
        autoCloseScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: false, new: true }
    );

    // Create buttons for user response
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
    );

    // Send message to both channels - buttons only in DMs
    await sendMessageToBothChannels(client, modmail, resolveEmbed, undefined, {
      dmComponents: [resolveButtons],
      threadComponents: [], // No buttons in thread
    });

    await interaction.editReply({
      content:
        "✅ Thread marked as resolved. The user has been notified and can choose to close the thread or request more help.",
    });

    log.info(`Modmail ${modmail._id} marked as resolved by staff member ${interaction.user.id}`);
    return true;
  } catch (error) {
    log.error("Error marking modmail as resolved:", error);

    await interaction.editReply({
      content: "❌ An error occurred while marking this thread as resolved.",
    });
    return true;
  }
}

/**
 * Handle close with reason button
 */
async function handleCloseWithReason(
  interaction: ButtonInteraction,
  modmail: ModmailDoc
): Promise<boolean> {
  try {
    const modal = new ModalBuilder()
      .setCustomId(`modmail_close_modal:${modmail._id}`)
      .setTitle("Close Modmail Thread");

    const reasonInput = new TextInputBuilder()
      .setCustomId("close_reason")
      .setLabel("Reason for closing")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for closing this modmail thread...")
      .setMaxLength(1000)
      .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
    return true;
  } catch (error) {
    log.error("Error showing close modal:", error);
    await interaction.reply({
      content: "❌ An error occurred while opening the close modal.",
      ephemeral: true,
    });
    return true;
  }
}

/**
 * Handle ban user button
 */
async function handleBanUser(
  interaction: ButtonInteraction,
  modmail: ModmailDoc
): Promise<boolean> {
  try {
    const modal = new ModalBuilder()
      .setCustomId(`modmail_ban_modal:${modmail._id}:${modmail.userId}`)
      .setTitle("Ban User from Modmail");

    const reasonInput = new TextInputBuilder()
      .setCustomId("ban_reason")
      .setLabel("Reason for ban")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for banning this user from modmail...")
      .setMaxLength(1000)
      .setRequired(true);

    const durationInput = new TextInputBuilder()
      .setCustomId("ban_duration")
      .setLabel("Duration (e.g., 1d, 1w, 1m, permanent)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("1d, 1w, 1m, permanent")
      .setMaxLength(20)
      .setRequired(true);

    const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);

    modal.addComponents(reasonRow, durationRow);

    await interaction.showModal(modal);
    return true;
  } catch (error) {
    log.error("Error showing ban modal:", error);
    await interaction.reply({
      content: "❌ An error occurred while opening the ban modal.",
      ephemeral: true,
    });
    return true;
  }
}
