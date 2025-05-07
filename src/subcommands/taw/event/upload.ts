import { AttachmentBuilder } from "discord.js";
import BasicEmbed from "../../../utils/BasicEmbed";
import { SlashCommandProps } from "commandkit";
import {
  getDbConnection,
  hasEventPermission,
  getEventsWithParticipants,
  getEventParticipants,
} from "./commons";

/**
 * Admin command: Uploads event participation data as a CSV
 */
export default async function eventUpload(props: SlashCommandProps) {
  const { interaction } = props;

  // Check permissions
  if (!(await hasEventPermission(props))) {
    return;
  }

  // Get database connection
  const { connection } = await getDbConnection(props);
  if (!connection) return;

  try {
    // Get completed events with participants
    const events = await getEventsWithParticipants(connection, true);

    if (events.length === 0) {
      await interaction.editReply({
        embeds: [
          BasicEmbed(
            interaction.client,
            "No Events to Upload",
            "There are no completed events with participation data to upload."
          ),
        ],
        content: null,
      });
      return;
    }

    // Generate CSV data for all events with participation data
    let csvContent =
      "Player_License,TAW_Name,Event_ID,Event_Name,Time_Joined,Time_Left,Time_Participated_Seconds,Time_Participated_Minutes\n";

    for (const event of events) {
      // Get participants for each event
      const participants = await getEventParticipants(connection, event.event_id);

      if (participants.length > 0) {
        for (const participant of participants) {
          // Calculate time participated in minutes (rounding to nearest minute)
          const timeParticipatedMinutes = participant.time_participated
            ? Math.round(participant.time_participated / 60)
            : 0;

          // Format CSV row
          csvContent += `${participant.player_license},`;
          csvContent += `${participant.player_name || "Unknown"},`;
          csvContent += `${participant.event_id},`;
          csvContent += `"${event.event_name.replace(/"/g, '""')}",`; // Escape quotes in CSV
          csvContent += `${participant.time_joined},`;
          csvContent += `${participant.time_left || ""},`;
          csvContent += `${participant.time_participated || ""},`;
          csvContent += `${timeParticipatedMinutes}\n`;
        }
      }
    }

    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Create file attachment with the CSV data
    const attachment = new AttachmentBuilder(Buffer.from(csvContent, "utf-8"), {
      name: `event-participation-${timestamp}.csv`,
    });

    // Send the CSV file
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Event Participation Data",
          `Generated CSV file containing participation data for ${events.length} event(s).`
        ),
      ],
      files: [attachment],
      content: null,
    });
  } catch (error) {
    console.error("Error generating event participation data:", error);
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Error",
          "Failed to generate event participation data. Please try again later."
        ),
      ],
      content: null,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
