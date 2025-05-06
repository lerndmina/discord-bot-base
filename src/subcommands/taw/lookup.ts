import { CommandInteraction, User } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import { getCharacterInfo } from "./commons";
import { getDiscordDate, TimeType } from "../../utils/TinyUtils";

/**
 * Format minutes into a readable time format (days, hours, minutes)
 */
function formatPlaytime(minutes: number): string {
  const days = Math.floor(minutes / 1440); // 1440 minutes in a day
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (remainingMinutes > 0 || parts.length === 0)
    parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`);

  return parts.join(", ");
}

export default async function lookup(interaction: CommandInteraction, targetUser: User | null) {
  const userToLookup = targetUser || interaction.user;
  const characterInfo = await getCharacterInfo(interaction, userToLookup);

  if (!characterInfo) {
    return; // Error messages already handled in getCharacterInfo
  }

  const { citizenId, charInfoParsed, userToProcess, playerIdentifiers } = characterInfo;

  // Format playtime
  const playtimeFormatted = formatPlaytime(playerIdentifiers.playtime_minutes);

  // Create a more detailed embed with the additional info
  await interaction.editReply({
    embeds: [
      BasicEmbed(
        interaction.client,
        `Info for ${charInfoParsed.firstname} ${charInfoParsed.lastname}`,
        `Character of <@${userToProcess.id}> (${userToProcess.id})`,
        [
          { name: "Citizen ID", value: `${citizenId}`, inline: true },
          { name: "Discord ID", value: `${userToProcess.id}`, inline: true },
          { name: "Birthdate", value: charInfoParsed.birthdate, inline: true },
          { name: "IBAN", value: `${charInfoParsed.iban}`, inline: true },
          { name: "Phone", value: charInfoParsed.phone || "None", inline: true },
          { name: "Nationality", value: charInfoParsed.nationality, inline: true },
          {
            name: "Online Status",
            value: playerIdentifiers.is_online ? "Online" : "Offline",
            inline: true,
          },
          {
            name: "Last Seen",
            value: `${getDiscordDate(
              playerIdentifiers.last_seen,
              TimeType.FULL_LONG
            )} (${getDiscordDate(playerIdentifiers.last_seen, TimeType.RELATIVE)})`,
            inline: true,
          },
          { name: "Total Playtime", value: playtimeFormatted, inline: true },
        ]
      ),
    ],
    content: null,
  });
}
