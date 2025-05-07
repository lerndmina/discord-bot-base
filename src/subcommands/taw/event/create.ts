import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import BasicEmbed from "../../../utils/BasicEmbed";
import { SlashCommandProps } from "commandkit";
import {
  getDbConnection,
  hasEventPermission,
  parseDateTime,
  parseDuration,
  formatDuration,
} from "./commons";

/**
 * Admin command: Creates a new event with a wizard interface
 */
export default async function eventCreate(props: SlashCommandProps) {
  const { interaction } = props;

  // Check permissions
  if (!(await hasEventPermission(props))) {
    return;
  }

  // Create the modal for event creation
  const modal = new ModalBuilder().setCustomId("event-create-modal").setTitle("Create New Event");

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
    await handleModalSubmit(modalResponse, props);
  } catch (error) {
    console.error("Modal submission error or timeout:", error);
    // We don't need to notify the user if they simply closed the modal without submitting
  }
}

/**
 * Handles the modal submission for event creation
 */
async function handleModalSubmit(modalSubmit: ModalSubmitInteraction, props: SlashCommandProps) {
  await modalSubmit.deferReply({ ephemeral: true });

  // Get database connection
  const { connection } = await getDbConnection({
    interaction: modalSubmit as any,
    client: props.client,
    handler: props.handler,
  } as SlashCommandProps);

  if (!connection) return;

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
        embeds: [
          BasicEmbed(
            modalSubmit.client,
            "Invalid Date Format",
            "Please use the format YYYY/MM/DD HH:MM:SS"
          ),
        ],
        content: null,
      });
      return;
    }

    // Parse duration
    const durationSeconds = parseDuration(durationString);
    if (durationSeconds <= 0) {
      await modalSubmit.editReply({
        embeds: [
          BasicEmbed(
            modalSubmit.client,
            "Invalid Duration Format",
            "Please use a format like '3h 20m 30s'"
          ),
        ],
        content: null,
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
        embeds: [
          BasicEmbed(modalSubmit.client, "Error", "This command can only be used in a guild."),
        ],
        content: null,
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
            modalSubmit.client,
            "Discord Event Creation Failed",
            "Failed to create Discord event. Please check if your inputs are valid and try again."
          ),
        ],
        content: null,
      });
      return;
    }

    // Insert event into database
    try {
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);

      const [result] = await connection.query(
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
            modalSubmit.client,
            "Event Created Successfully",
            `Your event "${eventName}" has been created!\n\n` +
              `**Event ID:** ${eventId}\n` +
              `**Start Time:** <t:${startTimeUnix}:F>\n` +
              `**End Time:** <t:${endTimeUnix}:F>\n` +
              `**Duration:** ${formatDuration(durationSeconds)}\n` +
              `**Discord Event:** ${discordEvent ? "Created" : "Failed"}`
          ),
        ],
        content: null,
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
            modalSubmit.client,
            "Database Error",
            "Failed to save the event to the database. The Discord event has been removed."
          ),
        ],
        content: null,
      });
    }
  } catch (error) {
    console.error("Error processing modal submission:", error);
    await modalSubmit.editReply({
      embeds: [
        BasicEmbed(modalSubmit.client, "Error", "An error occurred while creating the event."),
      ],
      content: null,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
