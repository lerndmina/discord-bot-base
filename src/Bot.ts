import {
  BaseInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Snowflake,
} from "discord.js";
import { CommandKit } from "commandkit";
import path from "path";
import mongoose, { Collection } from "mongoose";
import { config as dotenvConfig } from "dotenv";
import { createClient } from "redis";
import fetchEnvs from "./utils/FetchEnvs";
import { debugMsg } from "./utils/TinyUtils";
import log from "./utils/log";
const env = fetchEnvs();

export const Start = async () => {
  startTimer();

  const client = new Client({
    intents: [Object.keys(GatewayIntentBits).map((key) => GatewayIntentBits[key])],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  }) as Client<true>;

  // Using CommandKit (https://commandkit.underctrl.io)
  const commandKit = new CommandKit({
    client, // Discord.js client object | Required by default
    commandsPath: path.join(__dirname, "commands"), // The commands directory
    eventsPath: path.join(__dirname, "events"), // The events directory
    validationsPath: path.join(__dirname, "validations"), // Only works if commandsPath is provided
    devGuildIds: env.TEST_SERVERS,
    devUserIds: env.OWNER_IDS,
  });

  log.info(`Logging in to Discord with ${Object.keys(env).length} enviroment variables.`);

  await mongoose
    .connect(env.MONGODB_URI, { dbName: env.MONGODB_DATABASE, retryWrites: true })
    .then(() => {
      log.info("Connected to MongoDB");
      client.login(env.BOT_TOKEN);
    });

  await redisClient.connect();
};

/**
 * @description Random funny bot messages for a footer.
 */
export const BOT_MESSAGES: string[] = [
  "To contact the staff team, DM this bot and I'll open a ticket for you.",
  // "Got Kleptomania? Take something for it!",
  // "while (!asleep()) sheep++;",
  // "Took an hour to bury the cat... damn thing kept moving.",
  // "Apart from that Mrs Kennedy, how was the parade?",
  // "No sense being pessimistic. It wouldn't work anyway.",
  // "I'm not a complete idiot, some parts are missing.",
  // "In nuclear warfare all men are cremated equal.",
  // "If idiots could fly, this place would be an airport!",
  // "If ignorance is bliss, you must be orgasmic.",
  // "File not found. Should I fake it? (Y/N)",
  // "A wok is what you throw at a wabbit.",
  // "Never play leap-frog with a unicorn!",
];

export const ROLE_BUTTON_PREFIX = "roleGive-";

export const waitingEmoji: string = env.WAITING_EMOJI;

export const COOLDOWN_PREFIX = "cooldown";

export function userCooldownKey(userId: Snowflake, commandName: string) {
  return `${COOLDOWN_PREFIX}:${userId}:${commandName}`;
}

export function guildCooldownKey(guildId: Snowflake, commandName: string) {
  return `${COOLDOWN_PREFIX}:${guildId}:${commandName}`;
}

export function globalCooldownKey(commandName: string) {
  return `${COOLDOWN_PREFIX}:${commandName}`;
}

/**
 * @description Set a cooldown for a command
 * @param {string} key The key to set the cooldown for
 * @param {number} cooldownSeconds The cooldown in seconds
 * @returns {Promise<void>}
 */
export const setCommandCooldown = async function (key: string, cooldownSeconds: number) {
  const time = Date.now() + cooldownSeconds * 1000;
  const setting = await redisClient.set(key, time);
  log.debug(
    setting
      ? `Set cooldown for ${key} for ${cooldownSeconds}s`
      : `Failed to set cooldown for ${key}`
  );
  if (setting) await redisClient.expire(key, cooldownSeconds);
};

export function removeMentions(str: string) {
  return str.replace(/<@.*?>|@here|@everyone/g, "");
}

var startTime: Date;

export function startTimer() {
  startTime = new Date();
}

export function stopTimer() {
  const endTime = new Date();
  const timeDiff = endTime.getTime() - startTime.getTime();
  return timeDiff;
}

export const redisClient = createClient({
  url: env.REDIS_URL,
})
  //@ts-expect-error
  .on("error", (err) => {
    log.error("Redis Client Error", err);
    process.exit(1);
  })
  .on("ready", () => log.info("Redis Client Ready"));

Start();
