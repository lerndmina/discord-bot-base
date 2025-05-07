import { CommandInteraction, EmbedBuilder } from "discord.js";
import { fivemPool } from "../../../Bot";
import BasicEmbed from "../../../utils/BasicEmbed";
import { tryCatch } from "../../../utils/trycatch";
import { CommandOptions, SlashCommandProps } from "commandkit";

/**
 * Lists the current user's events with their participation start and end times with total time calculated
 */
export default async function eventHistory(props: SlashCommandProps) {
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
    // Get the user's Discord ID
    const discordId = interaction.user.id;

    // First, find the user's FiveM license from their Discord ID
    const [licenseResults] = await connection.query(
      `SELECT license FROM vrp_user_ids WHERE identifier LIKE 'discord:%' AND identifier = ?`,
      [`discord:${discordId}`]
    );

    if (!Array.isArray(licenseResults) || licenseResults.length === 0) {
      await interaction.editReply({
        embeds: [
          BasicEmbed(
            interaction.client,
            "No Player Record Found",
            "You do not have a linked FiveM account. Please join the server before using this command."
          )
        ]
      });
      return;
    }

    const playerLicense = licenseResults[0].license;

    // Query the user's event participation history
    const [history] = await connection.query(
      `SELECT 
        ep.participation_id,
        ep.event_id,
        ep.time_joined,
        ep.time_left,
        ep.time_spent_paused,
        ep.time_participated,
        e.event_name,
        e.event_description,
        e.event_scheduled_start,
        e.event_actual_start,
        e.event_scheduled_end,
        e.event_actual_end
      FROM 
        wild_events_players ep
      JOIN
        wild_events e ON ep.event_id = e.event_id
      WHERE 
        ep.player_license = ?
      ORDER BY 
        ep.time_joined DESC`,
      [playerLicense]
    );

    if (!Array.isArray(history) || history.length === 0) {
      await interaction.editReply({
        embeds: [
          BasicEmbed(
            interaction.client,
            "No Event History",
            "You haven't participated in any events yet."
          )
        ]
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Your Event Participation History")
      .setDescription(`Here's a record of your event participation:`)
      .setColor("#2ecc71")
      .setFooter({ text: `Discord ID: ${discordId}` });

    // Add each event participation record to the embed
    history.forEach((record: any) => {
      const joinTime = new Date(record.time_joined * 1000);
      const leaveTime = record.time_left ? new Date(record.time_left * 1000) : null;
      
      // Format times using Discord timestamp format
      const joinTimeFormatted = `<t:${record.time_joined}:f>`;
      const leaveTimeFormatted = record.time_left ? `<t:${record.time_left}:f>` : "Still participating";
      
      // Calculate total participation time in minutes
      let totalTimeText = "Still participating";
      if (record.time_participated) {
        const minutes = Math.floor(record.time_participated / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        totalTimeText = hours > 0 
          ? `${hours} hours ${remainingMinutes} minutes` 
          : `${minutes} minutes`;
      }

      embed.addFields({
        name: `${record.event_name} (ID: ${record.event_id})`,
        value: `**Joined:** ${joinTimeFormatted}\n**Left:** ${leaveTimeFormatted}\n**Total Time:** ${totalTimeText}`
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error fetching event history:", error);
    await interaction.editReply({
      embeds: [
        BasicEmbed(
          interaction.client,
          "Error",
          "Failed to fetch event history. Please try again later."
        )
      ]
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
