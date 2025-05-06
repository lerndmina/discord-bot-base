import { CommandInteraction, User } from "discord.js";
import { fivemPool } from "../../Bot";
import { tryCatch } from "../../utils/trycatch";

// Character info from the players table
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

// Player identifiers from the player_identifiers table
export interface PlayerIdentifiers {
  citizenid: string;
  license: string | null;
  discord: string | null;
  steam: string | null;
  fivem: string | null;
  ip: string | null;
  is_online: number;
  last_seen: number; // Timestamp as milliseconds since epoch
  last_updated: number; // Timestamp as milliseconds since epoch
  playtime_minutes: number; // New field for tracking playtime in minutes
}

// Combined data for character processing
export interface CharacterData {
  citizenId: string;
  charInfoParsed: CharacterInfo;
  userToProcess: User;
  playerIdentifiers: PlayerIdentifiers;
}

/**
 * Get character information for a Discord user
 * @param interaction The command interaction
 * @param userToLookup The Discord user to lookup
 * @returns CharacterData object or null if not found/error
 */
export async function getCharacterInfo(
  interaction: CommandInteraction,
  userToLookup: User
): Promise<CharacterData | null> {
  // Check database connection
  await interaction.editReply("Checking database connection...");
  if (!fivemPool) {
    await interaction.editReply(
      "Database connection is not available. Please contact the server admin."
    );
    return null;
  }

  // Get database connection from pool
  interaction.editReply("Database connection is available. Creating connection thread...");
  const { data: fivemDb, error: dbConnectionError } = await tryCatch(fivemPool.getConnection());
  if (dbConnectionError) {
    await interaction.editReply(`Failed to connect to the database: ${dbConnectionError.message}`);
    return null;
  }

  try {
    // Query player_identifiers table to find the character by Discord ID
    await interaction.editReply(`Executing query for user: ${userToLookup.username}...`);
    const discordIdentifier = `discord:${userToLookup.id}`;
    const { data: identifierRows, error: identifierQueryError } = await tryCatch(
      fivemDb.query(`SELECT * FROM player_identifiers WHERE discord = ?`, [discordIdentifier])
    );

    if (identifierQueryError) {
      await interaction.editReply(`Failed to execute query: ${identifierQueryError.message}`);
      return null;
    }

    await interaction.editReply(`Query executed. Found ${identifierRows?.length || 0} rows.`);

    // Check if user has a character
    const identifierRow = identifierRows?.[0] as PlayerIdentifiers | undefined;
    if (!identifierRow) {
      await interaction.editReply(
        `Character for ${userToLookup.username} was not found in the database. Please make sure they have logged into the server at least once and have created a character.`
      );
      return null;
    }

    const citizenId = identifierRow.citizenid;
    if (!citizenId) {
      await interaction.editReply(
        "Citizen ID was not found in the database. This should not happen. Please contact the server admin."
      );
      return null;
    }

    // Query players table to get character details
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

    // Parse character info JSON
    const charInfoParsed = JSON.parse(charInfo) as CharacterInfo;
    await interaction.editReply("Character information parsed.");

    // Return complete character data
    return {
      citizenId,
      charInfoParsed,
      userToProcess: userToLookup,
      playerIdentifiers: identifierRow,
    };
  } catch (error) {
    await interaction.editReply(`An unexpected error occurred: ${(error as Error).message}`);
    return null;
  } finally {
    // Always release the connection back to the pool
    fivemDb.release();
  }
}
