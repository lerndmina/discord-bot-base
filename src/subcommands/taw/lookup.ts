import { CommandInteraction, User } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import { getCharacterInfo } from "./commons";

export default async function lookup(interaction: CommandInteraction, targetUser: User | null) {
  const userToLookup = targetUser || interaction.user;
  const characterInfo = await getCharacterInfo(interaction, userToLookup);

  if (!characterInfo) {
    return; // Error messages already handled in getCharacterInfo
  }

  const { citizenId, charInfoParsed, userToProcess } = characterInfo;

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
        ]
      ),
    ],
  });
}
