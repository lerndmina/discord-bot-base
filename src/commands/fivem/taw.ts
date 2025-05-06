import type { SlashCommandProps, CommandOptions } from "commandkit";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { globalCooldownKey, setCommandCooldown, userCooldownKey } from "../../Bot";
import { initialReply } from "../../utils/initialReply";
import FetchEnvs, { DEFAULT_OPTIONAL_STRING } from "../../utils/FetchEnvs";

// Import subcommands
import changeTags from "../../subcommands/taw/tags";
import lookup from "../../subcommands/taw/lookup";
import setCharacterName from "../../subcommands/taw/name";

const env = FetchEnvs();

// This command requires fivem systems, the taw command and a fivem mysql uri to be defined in the env
if (
  env.ENABLE_FIVEM_SYSTEMS &&
  env.ENABLE_TAW_COMMAND &&
  env.FIVEM_MYSQL_URI !== DEFAULT_OPTIONAL_STRING
) {
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
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("lookup")
          .setDescription("Look up character information")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to look up (defaults to yourself)")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("name")
          .setDescription("Set your Discord name to your character name")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to set name for (defaults to yourself)")
              .setRequired(false)
          )
      ),
    options: {
      devOnly: false,
      deleted: false,
    },

    async run({ interaction, client, handler }: SlashCommandProps) {
      await initialReply(interaction, true);

      const subcommand = interaction.options.getSubcommand(true);
      const tags = interaction.options.getString("tags");
      const lookupUser = interaction.options.getUser("user");

      if (subcommand === "tags") {
        changeTags(tags, interaction);
      } else if (subcommand === "lookup") {
        setCommandCooldown(userCooldownKey(interaction.user.id, "taw"), 15);
        lookup(interaction, lookupUser);
      } else if (subcommand === "name") {
        setCommandCooldown(userCooldownKey(interaction.user.id, "taw"), 60);
        setCharacterName(interaction, lookupUser);
      } else {
        await interaction.editReply("Unknown subcommand.");
      }
    },
  };
} else {
  // Export an empty object or nothing at all when the feature is disabled
  module.exports = {};
}
