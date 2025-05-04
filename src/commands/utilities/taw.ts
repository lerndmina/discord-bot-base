import type { SlashCommandProps, CommandOptions } from "commandkit";
import {
  CommandInteraction,
  GuildMember,
  InteractionContextType,
  SlashCommandBuilder,
  User,
} from "discord.js";
import {
  fivemDb,
  globalCooldownKey,
  setCommandCooldown,
  userCooldownKey,
  waitingEmoji,
} from "../../Bot";
import generateHelpFields from "../../utils/data/static/generateHelpFields";
import { initialReply } from "../../utils/initialReply";
import FetchEnvs from "../../utils/FetchEnvs";
import { tryCatch, tryCatchSync } from "../../utils/trycatch";
import mariadb from "mariadb";
import { sleep } from "../../utils/TinyUtils";
import BasicEmbed from "../../utils/BasicEmbed";
import { title } from "process";
const env = FetchEnvs();
// Only include exports if the feature is enabled
if (env.ENABLE_TAW_COMMAND && env.FIVEM_MYSQL_URI) {
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

async function changeTags(tags: string | null, interaction: CommandInteraction) {
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

async function lookup(interaction: CommandInteraction, targetUser: User | null) {
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

async function setCharacterName(interaction: CommandInteraction, targetUser: User | null) {
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

// Common function to get character info
async function getCharacterInfo(interaction: CommandInteraction, userToLookup: User) {
  await interaction.editReply("Checking database connection...");

  if (!fivemDb) {
    await interaction.editReply(
      "Database connection is not available. Please contact the server admin."
    );
    return null;
  }

  await interaction.editReply(`Executing query for user: ${userToLookup.username}...`);
  const { data: rows, error: queryError } = await tryCatch(
    fivemDb.query(`SELECT * FROM player_identifiers WHERE discord = ?`, [
      `discord:${userToLookup.id}`,
    ])
  );

  if (queryError) {
    await interaction.editReply(`Failed to execute query: ${queryError.message}`);
    return null;
  }

  await interaction.editReply(`Query executed. Found ${rows?.length || 0} rows.`);
  const row = rows?.[0];
  if (!row) {
    await interaction.editReply(
      `Character for ${userToLookup.username} was not found in the database. Please make sure they have logged into the server at least once and have created a character.`
    );
    return null;
  }

  const citizenId = row.citizenid;
  if (!citizenId) {
    await interaction.editReply(
      "Citizen ID was not found in the database. This should not happen. Please contact the server admin."
    );
    return null;
  }

  await interaction.editReply("Fetching character details...");
  const { data: playerRows, error: playerError } = await tryCatch(
    fivemDb.query(`SELECT * FROM players WHERE citizenid = ?`, [citizenId])
  );

  if (playerError) {
    await interaction.editReply(`Failed to execute query: ${playerError.message}`);
    return null;
  }

  await interaction.editReply(`Query executed. Found ${playerRows?.length || 0} rows.`);
  const playerRow = playerRows?.[0];
  const charInfo = playerRow?.charinfo;

  if (!charInfo) {
    await interaction.editReply(
      "Character information was not found in the database. This should not happen. Please contact the server admin."
    );
    return null;
  }

  const charInfoParsed = JSON.parse(charInfo) as CharacterInfo;
  await interaction.editReply("Character information parsed.");

  return {
    citizenId,
    charInfoParsed,
    userToProcess: userToLookup,
  };
}

export interface CharacterInfo {
  birthdate: string;
  iban: number;
  firstname: string;
  lastname: string;
  nationality: string;
  account: string;
  gender: number;
  backstory: string;
  phone: string;
}
