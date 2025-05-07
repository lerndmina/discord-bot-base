import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import { fivemPool } from "../../../Bot";
import BasicEmbed from "../../../utils/BasicEmbed";
import { tryCatch } from "../../../utils/trycatch";
import canRunCommand from "../../../utils/canRunCommand";
import { CommandOptions, SlashCommandProps } from "commandkit";

/**
 * Admin command: Uploads event participation data as a CSV
 */
export default async function eventUpload(props: SlashCommandProps) {
  const { interaction, client, handler } = props;
  const options: CommandOptions = {
    userPermissions: ["ManageEvents"],
  };
  // Check if user has permission to upload event data
  if (!(await canRunCommand(props, options))) {
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Permission Denied",
          "You do not have permission to upload event data. This command requires the ManageEvents permission."
        ),
      ],
    });
    return;
  }

  if (!fivemPool) {
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Database Connection Error",
          "The fivem pool is not connected. Please contact an admin."
        ),
      ],
    });
    return;
  }

  const { data: connection, error: connectionError } = await tryCatch(fivemPool.getConnection());

  if (!connection) {
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Database Connection Error",
          "Failed to connect to the database. Please try again later.\n```\n" +
            connectionError +
            "\n```"
        ),
      ],
    });
    return;
  }

  // Query completed events that have participation data
  const [events] = await connection.query(`
        SELECT DISTINCT e.event_id, e.event_name 
        FROM wild_events e
        JOIN wild_events_players ep ON e.event_id = ep.event_id
        WHERE 
          e.event_actual_end IS NOT NULL OR 
          e.event_scheduled_end < UNIX_TIMESTAMP()
        ORDER BY e.event_id DESC
      `);

  if (!Array.isArray(events) || events.length === 0) {
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "No Events to Upload",
          "There are no completed events with participation data to upload."
        ),
      ],
    });
    return;
  }

  // Generate CSV data for all events with participation data
  let csvContent =
    "Player_License,TAW_Name,Event_ID,Event_Name,Time_Joined,Time_Left,Time_Participated_Seconds,Time_Participated_Minutes\n";

  for (const event of events) {
    // Get all participants for this event
    const [participants] = await connection.query(
      `
          SELECT 
            ep.player_license, 
            u.name as player_name,
            ep.event_id,
            e.event_name,
            ep.time_joined,
            ep.time_left,
            ep.time_participated
          FROM 
            wild_events_players ep
          JOIN
            wild_events e ON ep.event_id = e.event_id
          LEFT JOIN
            vrp_users u ON ep.player_license = u.license
          WHERE 
            ep.event_id = ?
        `,
      [event.event_id]
    );

    if (Array.isArray(participants) && participants.length > 0) {
      for (const participant of participants) {
        // Calculate time participated in minutes (rounding to nearest minute)
        const timeParticipatedMinutes = participant.time_participated
          ? Math.round(participant.time_participated / 60)
          : 0;

        // Format CSV row
        csvContent += `${participant.player_license},`;
        csvContent += `${participant.player_name || "Unknown"},`;
        csvContent += `${participant.event_id},`;
        csvContent += `"${participant.event_name.replace(/"/g, '""')}",`; // Escape quotes in CSV
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
  });
}
