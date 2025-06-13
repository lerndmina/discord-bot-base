import { ButtonInteraction, ChannelType, Client, InteractionType } from "discord.js";
import Database from "../../utils/data/database";
import Modmail from "../../models/Modmail";
import ModmailConfig from "../../models/ModmailConfig";
import { ThingGetter } from "../../utils/TinyUtils";
import { handleTag } from "../messageCreate/gotMail";
import FetchEnvs from "../../utils/FetchEnvs";
import log from "../../utils/log";
import {
  sendModmailCloseMessage,
  sendMessageToBothChannels,
  createDisabledResolveButtons,
} from "../../utils/ModmailUtils";
import BasicEmbed from "../../utils/BasicEmbed";

const env = FetchEnvs();

export default async (interaction: ButtonInteraction, client: Client<true>) => {
  if (interaction.type !== InteractionType.MessageComponent) return false;
  if (!interaction.isButton()) return false;

  const customId = interaction.customId;
  if (!customId.startsWith("modmail_resolve_") && !customId.startsWith("modmail_claim"))
    return false;

  const db = new Database();
  const getter = new ThingGetter(client);

  try {
    await interaction.deferReply({ ephemeral: true });

    // Find modmail by user ID (if in DMs) or by thread ID (if in thread)
    let modmail;

    if (interaction.channel?.type === 1) {
      // DM channel
      modmail = await db.findOne(Modmail, { userId: interaction.user.id });
    } else if (interaction.channel?.isThread()) {
      modmail = await db.findOne(Modmail, { forumThreadId: interaction.channel.id });
    }

    if (!modmail) {
      return interaction.editReply({
        content: "❌ Could not find an associated modmail thread.",
      });
    }

    if (customId === "modmail_claim") {
      // Handle claim button
      const hasStaffRole =
        interaction.member?.roles &&
        typeof interaction.member.roles !== "string" &&
        "cache" in interaction.member.roles
          ? interaction.member.roles.cache.has(env.STAFF_ROLE)
          : false;

      if (!hasStaffRole) {
        return interaction.editReply({
          content: "❌ You need to be a staff member to claim this ticket.",
        });
      }

      // Check if already claimed
      if (modmail.claimedBy) {
        return interaction.editReply({
          content: `❌ This ticket has already been claimed by <@${modmail.claimedBy}>.`,
        });
      }

      // Update modmail to mark as claimed
      await db.findOneAndUpdate(
        Modmail,
        { _id: modmail._id },
        {
          claimedBy: interaction.user.id,
          claimedAt: new Date(),
        },
        { upsert: false, new: true }
      );

      // Send claim notification
      const claimEmbed = BasicEmbed(
        client,
        "🎫 Ticket Claimed",
        `Your support ticket has been claimed by **${interaction.user.username}**.\n\n` +
          `They will be assisting you shortly. Please be patient while they review your request.`,
        undefined,
        "Blue"
      );

      await sendMessageToBothChannels(client, modmail, claimEmbed);

      await interaction.editReply({
        content: `✅ Successfully claimed ticket for <@${modmail.userId}>. You can now assist them in the thread.`,
      });

      log.info(`Modmail ${modmail._id} claimed by staff member ${interaction.user.id}`);
      return true;
    }

    if (customId === "modmail_resolve_close") {
      // Handle close resolution
      // Check if user is the ticket owner
      const isOwner = modmail.userId === interaction.user.id;

      if (!isOwner) {
        return interaction.editReply({
          content: "❌ Only the ticket owner can close this thread.",
        });
      }
      const closedBy = "User";
      const closedByName = interaction.user.username;
      const reason = "Resolved - Closed by user";

      // Disable the buttons in the original message
      try {
        if (interaction.message && interaction.channel?.type === 1) {
          // Only edit if in DM channel
          await interaction.message.edit({
            embeds: interaction.message.embeds,
            components: [createDisabledResolveButtons()],
          });
        }
      } catch (error) {
        log.warn("Failed to disable resolve buttons:", error);
      }

      // Send closure message using consistent styling
      await sendModmailCloseMessage(client, modmail, closedBy, closedByName, reason);

      // Update tags to closed
      const config = await db.findOne(ModmailConfig, { guildId: modmail.guildId });
      if (config) {
        const forumThread = await getter.getChannel(modmail.forumThreadId);
        if (forumThread && "setLocked" in forumThread) {
          const forumChannel = await getter.getChannel(config.forumChannelId);
          if (forumChannel && forumChannel.type === ChannelType.GuildForum) {
            await handleTag(null, config, db, forumThread, forumChannel);
          } else if (forumChannel) {
            log.warn(`Expected forum channel type GuildForum, got ${forumChannel.type}`);
          }

          // Lock and archive thread
          try {
            await forumThread.setLocked(true, `${closedBy} closed: ${reason}`);
            await forumThread.setArchived(true, `${closedBy} closed: ${reason}`);
          } catch (error) {
            log.warn(`Failed to lock/archive thread ${modmail.forumThreadId}:`, error);
          }
        }
      }

      // Remove from database
      await db.deleteOne(Modmail, { _id: modmail._id });
      await db.cleanCache(`${env.MONGODB_DATABASE}:${env.MODMAIL_TABLE}:userId:*`);

      await interaction.editReply({
        content: `✅ Thread closed successfully! Thank you for using our support system.`,
      });

      return true;
    }

    if (customId === "modmail_resolve_continue") {
      // Handle continue resolution
      // Check if user is the ticket owner
      const isOwner = modmail.userId === interaction.user.id;

      if (!isOwner) {
        return interaction.editReply({
          content: "❌ Only the ticket owner can use this button.",
        });
      } // Update modmail to unmark as resolved
      await db.findOneAndUpdate(
        Modmail,
        { _id: modmail._id },
        {
          markedResolved: false,
          resolvedAt: null,
          autoCloseScheduledAt: null,
          // Reset activity tracking
          lastUserActivityAt: new Date(),
          inactivityNotificationSent: null,
        },
        { upsert: false, new: true }
      );

      // Disable the buttons in the original message
      try {
        if (interaction.message && interaction.channel?.type === 1) {
          // Only edit if in DM channel
          await interaction.message.edit({
            embeds: interaction.message.embeds,
            components: [createDisabledResolveButtons()],
          });
        }
      } catch (error) {
        log.warn("Failed to disable resolve buttons:", error);
      }

      // Send continuation message
      const continueEmbed = BasicEmbed(
        client,
        "🆘 Additional Help Requested",
        `${interaction.user.username} has indicated they need more help with their support request.\n\n` +
          `The thread is now active again and staff will continue to assist you.`,
        undefined,
        "Orange"
      );

      await sendMessageToBothChannels(client, modmail, continueEmbed);

      await interaction.editReply({
        content: `✅ Your request for additional help has been noted. A staff member will continue to assist you.`,
      });

      log.info(`Modmail ${modmail._id} reopened by user ${interaction.user.id}`);
      return true;
    }

    return false;
  } catch (error) {
    log.error("Error in modmail resolve/claim button handler:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred while processing your request.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "❌ An error occurred while processing your request.",
      });
    }

    return true;
  }
};
