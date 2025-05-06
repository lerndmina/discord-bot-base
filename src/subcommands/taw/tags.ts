import { CommandInteraction, GuildMember } from "discord.js";
import { tryCatch } from "../../utils/trycatch";

export default async function changeTags(tags: string | null, interaction: CommandInteraction) {
  const maxTagLength = 6;
  if (!tags) {
    return interaction.editReply("Please provide your TAW tags.");
  }
  const cleanTags = tags.replace("[", "").replace("]", "").toUpperCase();

  if (cleanTags.length > maxTagLength) {
    return interaction.editReply(`Your TAW tags cannot be longer than ${maxTagLength} characters.`);
  }

  const member = interaction.member as GuildMember;
  const memberName = member.nickname || member.user.displayName;
  const existingTags = member.nickname?.match(/\[(.*?)\]/)?.[1] || "";
  const cleanNickname = member.nickname?.replace(/\[(.*?)\]/, "") || "";
  const { data, error } = await tryCatch(member.setNickname(`${cleanNickname} [${cleanTags}]`));
  if (error) {
    return interaction.editReply(`Failed to set your TAW tags. ${error.message}`);
  }
  return interaction.editReply(`Successfully set your TAW tags to: [${tags}]`);
}
