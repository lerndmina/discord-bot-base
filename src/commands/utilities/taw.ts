import type { SlashCommandProps, CommandOptions } from "commandkit";
import {
  CommandInteraction,
  GuildMember,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { globalCooldownKey, setCommandCooldown, waitingEmoji } from "../../Bot";
import generateHelpFields from "../../utils/data/static/generateHelpFields";
import { initialReply } from "../../utils/initialReply";
import FetchEnvs from "../../utils/FetchEnvs";
import { tryCatch } from "../../utils/trycatch";
const env = FetchEnvs();

// Only include exports if the feature is enabled
if (env.ENABLE_TAW_COMMAND) {
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("taw")
      .setDescription("This is a template command.")
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("tags")
          .setDescription("Set your TAW tags.")
          .addStringOption((option) =>
            option.setName("tags").setDescription("Your TAW tags.").setRequired(true)
          )
      ),

    options: {
      devOnly: false,
      deleted: false,
    },

    async run({ interaction, client, handler }: SlashCommandProps) {
      await initialReply(interaction, true);

      const subcommand = interaction.options.getSubcommand(true);
      const tags = interaction.options.getString("tags", true);

      if (subcommand === "tags") {
        changeTags(tags, interaction);
      }
    },
  };
} else {
  // Export an empty object or nothing at all when the feature is disabled
  module.exports = {};
}

async function changeTags(tags: string, interaction: CommandInteraction) {
  const maxTagLength = 6;
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
