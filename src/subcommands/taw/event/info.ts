import { EmbedBuilder } from "discord.js";
import BasicEmbed from "../../../utils/BasicEmbed";
import { SlashCommandProps } from "commandkit";
import { getDbConnection, getUpcomingEvents } from "./commons";

/**
 * Lists all planned in-game events, with the earliest one being at the top of the list
 */
export default async function eventInfo(props: SlashCommandProps) {
  const { interaction } = props;

  // Get database connection
  const { connection } = await getDbConnection(props);
  if (!connection) return;

  try {
    // Get upcoming events
    const events = await getUpcomingEvents(connection);

    if (events.length === 0) {
      await interaction.editReply({
        embeds: [
          BasicEmbed(
            interaction.client,
            "No Upcoming Events",
            "There are no upcoming events scheduled at this time."
          ),
        ],
        content: null,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📅 Upcoming Events")
      .setDescription("Here are all the upcoming in-game events:")
      .setColor("#3498db");

    // Add each event to the embed
    events.forEach((event) => {
      // Format the date/time nicely
      const startTimeFormatted = `<t:${event.event_scheduled_start}:F>`;
      const endTimeFormatted = event.event_scheduled_end
        ? `<t:${event.event_scheduled_end}:F>`
        : "TBD";

      const statusEmoji = event.is_running ? "🟢 Running" : "⏱️ Upcoming";

      embed.addFields({
        name: `${statusEmoji} | ${event.event_name} (ID: ${event.event_id})`,
        value: `**Description:** ${
          event.event_description || "No description provided"
        }\n**Start:** ${startTimeFormatted}\n**End:** ${endTimeFormatted}`,
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
