import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { fivemPool } from "../../../Bot";
import BasicEmbed from "../../../utils/BasicEmbed";
import { tryCatch } from "../../../utils/trycatch";
import canRunCommand from "../../../utils/canRunCommand";

/**
 * Admin command: Creates a new event with a wizard interface
 */
export default async function eventCreate(interaction: CommandInteraction) {
  return await tryCatch(
    async () => {
      // Check if user has permission to create events
      if (!(await canRunCommand(interaction, "ManageEvents"))) {
        await interaction.editReply({
          embeds: [
            BasicEmbed(
              interaction.client,
              "Permission Denied",
              "You do not have permission to create events. This command requires the ManageEvents permission."
            ),
          ],
        });
        return;
      }

      // Create the modal for event creation
      const modal = new ModalBuilder()
        .setCustomId("event-create-modal")
        .setTitle("Create New Event");

      // Add inputs for event details
      const nameInput = new TextInputBuilder()
        .setCustomId("event-name")
        .setLabel("Event Name")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter event name")
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId("event-description")
        .setLabel("Event Description")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Enter event description")
        .setRequired(true)
        .setMaxLength(1000);

      const startTimeInput = new TextInputBuilder()
        .setCustomId("event-start-time")
        .setLabel("Start Time (YYYY/MM/DD HH:MM:SS)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 2025/05/15 18:30:00")
        .setRequired(true);

      const durationInput = new TextInputBuilder()
        .setCustomId("event-duration")
        .setLabel("Duration (e.g. 3h 20m 30s)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 2h 30m")
        .setRequired(true);

      // Add inputs to action rows (required for modals)
      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(startTimeInput);
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);

      // Add rows to the modal
      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

      // Show the modal to the user
      await interaction.showModal(modal);

      // Wait for modal submission
      const filter = (i: any) => i.customId === "event-create-modal";
      try {
        const modalResponse = await interaction.awaitModalSubmit({ filter, time: 300000 }); // 5 minute timeout

        // Process form submission
        await handleModalSubmit(modalResponse, interaction);
      } catch (error) {
        console.error("Modal submission error or timeout:", error);
        // We don't need to notify the user if they simply closed the modal without submitting
      }
    },
    interaction,
    "Failed to create event"
  );
}

/**
 * Handles the modal submission for event creation
 */
async function handleModalSubmit(
  modalSubmit: ModalSubmitInteraction,
  originalInteraction: CommandInteraction
) {
  await modalSubmit.deferReply({ ephemeral: true });

  try {
    // Extract form values
    const eventName = modalSubmit.fields.getTextInputValue("event-name");
    const eventDescription = modalSubmit.fields.getTextInputValue("event-description");
    const startTimeString = modalSubmit.fields.getTextInputValue("event-start-time");
    const durationString = modalSubmit.fields.getTextInputValue("event-duration");

    // Parse start time
    const startTime = parseDateTime(startTimeString);
    if (!startTime) {
      await modalSubmit.editReply({
        embeds: [BasicEmbed("Invalid Date Format", "Please use the format YYYY/MM/DD HH:MM:SS")],
      });
      return;
    }

    // Parse duration
    const durationSeconds = parseDuration(durationString);
    if (durationSeconds <= 0) {
      await modalSubmit.editReply({
        embeds: [BasicEmbed("Invalid Duration Format", "Please use a format like '3h 20m 30s'")],
      });
      return;
    }

    // Calculate end time
    const endTimeUnix = Math.floor(startTime.getTime() / 1000) + durationSeconds;
    const endTime = new Date(endTimeUnix * 1000);

    // Get guild from interaction for creating Discord event
    const guild = modalSubmit.guild;
    if (!guild) {
      await modalSubmit.editReply({
        embeds: [BasicEmbed("Error", "This command can only be used in a guild.")],
      });
      return;
    }

    // Create Discord scheduled event
    let discordEvent;
    try {
      discordEvent = await guild.scheduledEvents.create({
        name: eventName,
        description: eventDescription,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: {
          location: "In-Game Event",
        },
      });
    } catch (error) {
      console.error("Failed to create Discord event:", error);
      await modalSubmit.editReply({
        embeds: [
          BasicEmbed(
            "Discord Event Creation Failed",
            "Failed to create Discord event. Please check if your inputs are valid and try again."
          ),
        ],
      });
      return;
    }

    // Insert event into database
    try {
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);

      const [result] = await fivemPool.query(
        `INSERT INTO wild_events (
          event_name,
          event_description,
          event_scheduled_start,
          event_scheduled_end
        ) VALUES (?, ?, ?, ?)`,
        [eventName, eventDescription, startTimeUnix, endTimeUnix]
      );

      // Get the event ID from the insertion result
      const eventId = result.insertId;

      // Confirm successful creation
      await modalSubmit.editReply({
        embeds: [
          BasicEmbed(
            "Event Created Successfully",
            `Your event "${eventName}" has been created!\n\n` +
              `**Event ID:** ${eventId}\n` +
              `**Start Time:** <t:${startTimeUnix}:F>\n` +
              `**End Time:** <t:${endTimeUnix}:F>\n` +
              `**Duration:** ${formatDuration(durationSeconds)}\n` +
              `**Discord Event:** ${discordEvent ? "Created" : "Failed"}`
          ),
        ],
      });
    } catch (error) {
      console.error("Failed to insert event into database:", error);

      // Try to delete the Discord event if we failed to save to the database
      if (discordEvent) {
        try {
          await discordEvent.delete();
        } catch (deleteError) {
          console.error("Failed to delete Discord event after database error:", deleteError);
        }
      }

      await modalSubmit.editReply({
        embeds: [
          BasicEmbed(
            "Database Error",
            "Failed to save the event to the database. The Discord event has been removed."
          ),
        ],
      });
    }
  } catch (error) {
    console.error("Error processing modal submission:", error);
    await modalSubmit.editReply({
      embeds: [BasicEmbed("Error", "An error occurred while creating the event.")],
    });
  }
}

/**
 * Parses a date-time string in format YYYY/MM/DD HH:MM:SS
 * @returns Date object or null if invalid
 */
function parseDateTime(dateTimeStr: string): Date | null {
  // Try to parse the date string
  try {
    // Match YYYY/MM/DD HH:MM:SS format
    const match = dateTimeStr.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/
    );
    if (!match) return null;

    const [_, year, month, day, hours, minutes, seconds] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // JavaScript months are 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );

    // Validate the date is valid
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Parses a duration string like "3h 20m 30s" into seconds
 */
function parseDuration(durationStr: string): number {
  let totalSeconds = 0;

  // Match hours
  const hoursMatch = durationStr.match(/(\d+)h/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1]) * 3600;
  }

  // Match minutes
  const minutesMatch = durationStr.match(/(\d+)m/);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1]) * 60;
  }

  // Match seconds
  const secondsMatch = durationStr.match(/(\d+)s/);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1]);
  }

  return totalSeconds;
}

/**
 * Formats duration in seconds to a human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let formattedTime = "";
  if (hours > 0) formattedTime += `${hours} hour${hours > 1 ? "s" : ""} `;
  if (minutes > 0) formattedTime += `${minutes} minute${minutes > 1 ? "s" : ""} `;
  if (remainingSeconds > 0)
    formattedTime += `${remainingSeconds} second${remainingSeconds > 1 ? "s" : ""} `;

  return formattedTime.trim();
}
