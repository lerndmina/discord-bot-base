import Questionnaire, { QuestionnaireType } from "../models/Questionnaire";
import Database from "../utils/data/database";
import QuestionnaireBuilder from "./QuestionnaireBuilder";

const db = new Database();

export default class QuestionnaireService {
  /**
   * Create a new questionnaire
   * @param guildId The guild ID
   * @param name The name of the questionnaire
   * @param description The description of the questionnaire
   * @param questions The list of questions
   */ static async create(
    guildId: string,
    name: string,
    description: string,
    questions: any[]
  ): Promise<QuestionnaireType | null> {
    console.log(`Creating questionnaire: guildId=${guildId}, name=${name}`);

    const questionnaire = new Questionnaire({
      guildId,
      name,
      description,
      questions,
    });

    const existsCheck = await this.exists(guildId, name);
    console.log(`Exists check result: ${existsCheck}`);

    if (existsCheck) {
      console.log(`Questionnaire already exists, returning null`);
      return null; // Questionnaire already exists
    }

    console.log(`Proceeding to create questionnaire...`);
    await db.findOneAndUpdate(Questionnaire, { guildId, name }, questionnaire, {
      upsert: true,
      new: true,
    });
    return questionnaire;
  }

  /**
   * Get a specific questionnaire by guild and name
   * @param guildId The guild ID
   * @param name The name of the questionnaire
   */
  async getQuestionnaire(guildId: string, name: string): Promise<QuestionnaireType | null> {
    return await db.findOne(Questionnaire, { guildId, name });
  }
  /**
   * Check if a questionnaire exists by guild and name
   */
  static async exists(guildId: string, name: string): Promise<boolean> {
    // Use a more specific query to avoid cache key collision issues
    // The Database class has a bug where cache keys only use the first query field
    console.log(`Checking if questionnaire exists: guildId=${guildId}, name=${name}`);

    const existing = await db.findOne(Questionnaire, { guildId, name }, false, 60); // Short cache time
    console.log(
      `Query result:`,
      existing ? { name: existing.name, guildId: existing.guildId } : null
    );

    if (existing) {
      return true; // Questionnaire exists
    }
    return false; // Questionnaire does not exist
  }

  /**
   * Find all questionnaires for a guild
   */
  static async findByGuild(guildId: string): Promise<QuestionnaireType[]> {
    return (await db.find(Questionnaire, { guildId })) || [];
  }
}

// Export the builder for easy access
export { QuestionnaireBuilder };
