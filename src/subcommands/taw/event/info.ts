import { CommandInteraction, EmbedBuilder } from "discord.js";
import { fivemPool } from "../../../Bot";
import BasicEmbed from "../../../utils/BasicEmbed";
import { tryCatch } from "../../../utils/trycatch";
import { CommandOptions, SlashCommandProps } from "commandkit";

/**
 * Lists all planned in-game events, with the earliest one being at the top of the list
 */
export default async function eventInfo(props: SlashCommandProps) {
  const { interaction, client, handler } = props;

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

  try {
    // Query all events that haven't ended yet (scheduled end time is in the future)
    const [events] = await connection.query(
      `SELECT * FROM wild_events 
       WHERE event_scheduled_end > UNIX_TIMESTAMP() OR event_scheduled_end IS NULL 
       ORDER BY event_scheduled_start ASC`
    );

    if (!Array.isArray(events) || events.length === 0) {
      await interaction.editReply({ 
        embeds: [
          BasicEmbed(
            interaction.client,
            "No Upcoming Events", 
            "There are no upcoming events scheduled at this time."
          )
        ] 
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📅 Upcoming Events")
      .setDescription("Here are all the upcoming in-game events:")
      .setColor("#3498db");

    // Add each event to the embed
    events.forEach((event: any) => {
      const startTime = new Date(event.event_scheduled_start * 1000);
      const endTime = event.event_scheduled_end 
        ? new Date(event.event_scheduled_end * 1000) 
        : null;
      
      // Format the date/time nicely
      const startTimeFormatted = `<t:${event.event_scheduled_start}:F>`;
      const endTimeFormatted = event.event_scheduled_end 
        ? `<t:${event.event_scheduled_end}:F>` 
        : "TBD";
      
      const statusEmoji = event.is_running ? "🟢 Running" : "⏱️ Upcoming";
      
      embed.addFields({
        name: `${statusEmoji} | ${event.event_name} (ID: ${event.event_id})`,
        value: `**Description:** ${event.event_description || "No description provided"}\n**Start:** ${startTimeFormatted}\n**End:** ${endTimeFormatted}`
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error fetching event information:", error);
    await interaction.editReply({ 
      embeds: [
        BasicEmbed(
          interaction.client,
          "Error", 
          "Failed to fetch event information. Please try again later."
        )
      ] 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
