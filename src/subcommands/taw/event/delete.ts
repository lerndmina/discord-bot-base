import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { fivemPool } from "../../../Bot";
import BasicEmbed from "../../../utils/BasicEmbed";
import { tryCatch } from "../../../utils/trycatch";
import canRunCommand from "../../../utils/canRunCommand";

/**
 * Admin command: Deletes an event with the given ID after confirmation
 */
export default async function eventDelete(interaction: CommandInteraction, eventId: number | null) {
  return await trycatch(
    async () => {
      // Check if user has permission to delete events
      if (!(await canRunCommand(interaction, "ManageEvents"))) {
        await interaction.editReply({
          embeds: [
            BasicEmbed(
              "Permission Denied",
              "You do not have permission to delete events. This command requires the ManageEvents permission."
            ),
          ],
        });
        return;
      }

      // Check that the event ID is valid
      if (!eventId || eventId <= 0) {
        await interaction.editReply({
          embeds: [BasicEmbed("Invalid Event ID", "Please provide a valid event ID to delete.")],
        });
        return;
      }

      // First, fetch the event details to confirm it exists and to show details
      const [events] = await fivemPool.query("SELECT * FROM wild_events WHERE event_id = ?", [
        eventId,
      ]);

      if (!Array.isArray(events) || events.length === 0) {
        await interaction.editReply({
          embeds: [BasicEmbed("Event Not Found", `No event found with ID ${eventId}.`)],
        });
        return;
      }

      const event = events[0];

      // Get Discord event ID if it exists (not implemented in current schema)
      // This would be added to the schema in a future update

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm-delete-${eventId}`)
        .setLabel("Yes, Delete Event")
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel-delete-${eventId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

      // Format dates for display
      const startTimeFormatted = event.event_scheduled_start
        ? `<t:${event.event_scheduled_start}:F>`
        : "Not scheduled";

      const endTimeFormatted = event.event_scheduled_end
        ? `<t:${event.event_scheduled_end}:F>`
        : "Not scheduled";

      // Send confirmation message
      const reply = await interaction.editReply({
        embeds: [
          BasicEmbed(
            "Confirm Event Deletion",
            `Are you sure you want to delete this event?\n\n` +
              `**Name:** ${event.event_name}\n` +
              `**ID:** ${event.event_id}\n` +
              `**Description:** ${event.event_description}\n` +
              `**Start Time:** ${startTimeFormatted}\n` +
              `**End Time:** ${endTimeFormatted}\n` +
              `**Status:** ${event.is_running ? "🟢 Running" : "⏱️ Scheduled"}\n\n` +
              `⚠️ **Warning:** This action cannot be undone. All event participation data will be permanently deleted.`
          ),
        ],
        components: [row],
      });

      // Wait for button interaction
      try {
        // Create collector for button interactions
        const filter = (i: ButtonInteraction) =>
          i.user.id === interaction.user.id &&
          (i.customId === `confirm-delete-${eventId}` || i.customId === `cancel-delete-${eventId}`);

        const collector = reply.createMessageComponentCollector({
          filter,
          time: 60000, // 1 minute timeout
          max: 1,
        });

        collector.on("collect", async (buttonInteraction) => {
          if (buttonInteraction.customId === `confirm-delete-${eventId}`) {
            await buttonInteraction.deferUpdate();

            try {
              // Check if there's a Discord event to delete (would be implemented in future)

              // Delete the event from the database
              // This will cascade to delete all participation records due to foreign key constraints
              await fivemPool.query("DELETE FROM wild_events WHERE event_id = ?", [eventId]);

              // Confirm deletion
              await buttonInteraction.editReply({
                embeds: [
                  BasicEmbed(
                    "Event Deleted",
                    `Event "${event.event_name}" (ID: ${eventId}) has been successfully deleted.`
                  ),
                ],
                components: [], // Remove buttons
              });
            } catch (error) {
              console.error("Error deleting event:", error);
              await buttonInteraction.editReply({
                embeds: [
                  BasicEmbed(
                    "Error",
                    "An error occurred while deleting the event. Please try again."
                  ),
                ],
                components: [], // Remove buttons
              });
            }
          } else {
            // User cancelled
            await buttonInteraction.update({
              embeds: [
                BasicEmbed(
                  "Deletion Cancelled",
                  `Event "${event.event_name}" (ID: ${eventId}) was not deleted.`
                ),
              ],
              components: [], // Remove buttons
            });
          }
        });

        collector.on("end", async (collected, reason) => {
          if (reason === "time" && collected.size === 0) {
            // Timeout - no button was pressed
            await interaction.editReply({
              embeds: [
                BasicEmbed("Deletion Cancelled", "Event deletion was cancelled due to timeout."),
              ],
              components: [], // Remove buttons
            });
          }
        });
      } catch (error) {
        console.error("Error with button collector:", error);
        await interaction.editReply({
          embeds: [BasicEmbed("Error", "An error occurred while waiting for confirmation.")],
          components: [], // Remove buttons
        });
      }
    },
    interaction,
    "Failed to delete event"
  );
}
