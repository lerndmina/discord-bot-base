import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ModalSubmitInteraction,
} from "discord.js";
import log from "../../utils/log";
import { redisClient } from "../../Bot";
import crypto from "crypto";

// Generate a short unique ID (6 characters)
function generateShortId(): string {
  return crypto.randomBytes(3).toString("hex");
}

export default async (interaction: ModalSubmitInteraction, client: Client<true>) => {
  if (!interaction.isModalSubmit()) return false;

  // Handle moderation modals
  if (interaction.customId.startsWith("mod_")) {
    // Require manage messages permission
    if (!interaction.memberPermissions?.has("ManageMessages")) {
      await interaction.reply({
        content: "You need the Manage Messages permission to use these moderation actions.",
        ephemeral: true,
      });
      return true;
    }

    // Extract the action and args from the customId
    const [action, ...args] = interaction.customId.split(":");

    switch (action) {
      case "mod_warn_modal": {
        const userId = args[0];
        const warningMessage = interaction.fields.getTextInputValue("warningMessage");

        // Generate a short unique key for Redis storage
        const shortKey = generateShortId();

        // Store the warning message in Redis with 5 minute expiry
        const storageData = {
          type: "warning",
          message: warningMessage,
          userId: userId,
        };

        await redisClient.set(`mod:${shortKey}`, JSON.stringify(storageData), {
          EX: 5 * 60, // 5 minutes expiry
        });

        // Show confirmation button with short key
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_scw:${shortKey}`)
            .setLabel("Yes, Send Warning")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: `**Preview of warning message:**\n\n${warningMessage}\n\n**Are you sure you want to send this warning?**`,
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }

      case "mod_timeout_modal": {
        const userId = args[0];
        const duration = interaction.fields.getTextInputValue("duration");
        const reason = interaction.fields.getTextInputValue("reason");

        // Validate duration is a number
        const durationMinutes = parseInt(duration);
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
          await interaction.reply({
            content: "Invalid duration. Please enter a positive number of minutes.",
            ephemeral: true,
          });
          return true;
        }

        // Generate a short unique key for Redis storage
        const shortKey = generateShortId();

        // Store the timeout data in Redis with 5 minute expiry
        const storageData = {
          type: "timeout",
          reason: reason,
          userId: userId,
          durationMinutes: durationMinutes,
        };

        await redisClient.set(`mod:${shortKey}`, JSON.stringify(storageData), {
          EX: 5 * 60, // 5 minutes expiry
        });

        // Show timeout confirmation with short key
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_sto:${shortKey}`)
            .setLabel("Yes, Timeout User")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: `Are you sure you want to timeout <@${userId}> for ${durationMinutes} minutes?\n\n**Reason:** ${reason}`,
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }
    }

    // If we get here, we handled a mod_ modal but didn't have a specific case for it
    return true;
  }

  // Not a mod_ modal, let other handlers process it
  return false;
};
