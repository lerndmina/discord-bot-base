import { CommandInteraction, User } from "discord.js";
import { fivemPool } from "../../Bot";
import { tryCatch } from "../../utils/trycatch";

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

export interface CharacterData {
  citizenId: string;
  charInfoParsed: CharacterInfo;
  userToProcess: User;
}

// Common function to get character info
export async function getCharacterInfo(
  interaction: CommandInteraction,
  userToLookup: User
): Promise<CharacterData | null> {
  await interaction.editReply("Checking database connection...");

  if (!fivemPool) {
    await interaction.editReply(
      "Database connection is not available. Please contact the server admin."
    );
    return null;
  }

  interaction.editReply("Database connection is available. Creating connection thread...");

  const { data: fivemDb, error: dbConnectionError } = await tryCatch(fivemPool.getConnection());
  if (dbConnectionError) {
    await interaction.editReply(`Failed to connect to the database: ${dbConnectionError.message}`);
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
    fivemDb.release(); // Release the connection back to the pool
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

  fivemDb.release(); // Release the connection back to the pool

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
