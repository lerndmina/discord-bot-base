import { CommandInteraction, GuildMember, User } from "discord.js";
import { sleep } from "../../utils/TinyUtils";
import { tryCatch } from "../../utils/trycatch";
import { getCharacterInfo } from "./commons";
import FetchEnvs from "../../utils/FetchEnvs";

const env = FetchEnvs();

export default async function setCharacterName(
  interaction: CommandInteraction,
  targetUser: User | null
) {
  const userToSet = targetUser || interaction.user;

  // Check if the requesting user has permission to change someone else's name
  if (targetUser && targetUser.id !== interaction.user.id) {
    // Check if the user has admin or mod permissions
    const member = interaction.member as GuildMember;
    if (!member.permissions.has("Administrator") && !member.permissions.has("ModerateMembers")) {
      return interaction.editReply("You don't have permission to change other users' names.");
    }
  }

  // Get target member
  const guild = interaction.guild;
  if (!guild) {
    return interaction.editReply("This command can only be used in a server.");
  }

  const targetMember = await guild.members.fetch(userToSet.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply(`Couldn't find the member ${userToSet.username} in this server.`);
  }

  const characterInfo = await getCharacterInfo(interaction, userToSet);

  if (!characterInfo) {
    return; // Error messages already handled in getCharacterInfo
  }

  const { charInfoParsed } = characterInfo;

  // Preserve TAW tags if they exist
  const existingTags = targetMember.nickname?.match(/\[(.*?)\]$/)?.[0] || "";

  // Try with full name and tags
  let newName = `${charInfoParsed.firstname} ${charInfoParsed.lastname}${
    existingTags ? " " + existingTags : ""
  }`;

  await interaction.editReply(`Attempting to set nickname to: ${newName}`);
  sleep(3000);

  // Check if name is too long (Discord limit is 32 characters)
  if (newName.length > 32) {
    await interaction.editReply(
      `Full name with tags is too long (${newName.length}). Trying with first name only... ${env.WAITING_EMOJI}`
    );
    await sleep(5000);

    // Try with first name and tags
    newName = `${charInfoParsed.firstname}${existingTags ? " " + existingTags : ""}`;

    // Check if still too long
    if (newName.length > 32) {
      await interaction.editReply(
        `First name with tags is still too long (${newName.length}). Trying without tags... ${env.WAITING_EMOJI}`
      );
      await sleep(5000);

      // Try with full name without tags
      newName = `${charInfoParsed.firstname} ${charInfoParsed.lastname}`;

      // Check if still too long
      if (newName.length > 32) {
        // Try with first name only, no tags
        newName = charInfoParsed.firstname;

        // Final check
        if (newName.length > 32) {
          return interaction.editReply(
            `Unable to set nickname: All name options exceed Discord's 32 character limit. ` +
              `Please contact a server administrator to set a shorter name manually.`
          );
        }
      }
    }
  }

  await interaction.editReply(`Setting nickname to: ${newName}`);

  const { data, error } = await tryCatch(targetMember.setNickname(newName));
  if (error) {
    return interaction.editReply(
      `Failed to set nickname: ${error.message}. Please set your nickname manually to the following:\n\`\`\`${newName}\`\`\``
    );
  }

  return interaction.editReply(
    `Successfully set ${targetUser ? targetUser.username + "'s" : "your"} nickname to ${newName}`
  );
}
