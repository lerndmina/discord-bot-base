import { SnowflakeUtil } from "discord.js";

import dotenv from "dotenv";
import log from "./log";
dotenv.config();

export const DEFAULT_OPTIONAL_STRING = "optional";

var accessedCount = 0;

function getter() {
  // Key value array to store the environment variables
  var env: {
    BOT_TOKEN: string;
    OWNER_IDS: string[];
    TEST_SERVERS: string[];
    PREFIX: string;
    MONGODB_URI: string;
    MONGODB_DATABASE: string;
    WAITING_EMOJI: string;
    REDIS_URL: string;
    DEBUG_LOG: boolean;
    MODMAIL_TABLE: string;
    DEFAULT_TIMEZONE: string;
    STAFF_ROLE: string;
    OPENAI_API_KEY: string;
    ALLOWED_DEPLOY_DOMAINS: string[];
    ZIPLINE_BASEURL: string;
    ZIPLINE_TOKEN: string;
  } = {
    BOT_TOKEN: process.env.BOT_TOKEN || "",
    OWNER_IDS: (process.env.OWNER_IDS || "").trim().split(","),
    TEST_SERVERS: (process.env.TEST_SERVERS || "").trim().split(","),
    PREFIX: process.env.PREFIX || "",
    MONGODB_URI: process.env.MONGODB_URI || "",
    MONGODB_DATABASE: process.env.MONGODB_DATABASE || "test",
    WAITING_EMOJI: process.env.WAITING_EMOJI || "",
    REDIS_URL: process.env.REDIS_URL || "",
    DEBUG_LOG: process.env.DEBUG_LOG === "true",
    MODMAIL_TABLE: process.env.MODMAIL_TABLE || "",
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Europe/London",
    STAFF_ROLE: process.env.STAFF_ROLE || DEFAULT_OPTIONAL_STRING,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || DEFAULT_OPTIONAL_STRING,
    ALLOWED_DEPLOY_DOMAINS: (process.env.ALLOWED_DEPLOY_DOMAINS || "").trim().split(","),
    ZIPLINE_BASEURL: process.env.ZIPLINE_BASEURL || DEFAULT_OPTIONAL_STRING,
    ZIPLINE_TOKEN: process.env.ZIPLINE_TOKEN || DEFAULT_OPTIONAL_STRING,
  };

  var missingKeys: string[] = [];
  for (const keyString in env) {
    const key = keyString as keyof typeof env;
    const value = env[key];
    if (value === undefined || value === null || value === "") {
      missingKeys.push(key);
    }
    if (value === DEFAULT_OPTIONAL_STRING || value[0] === DEFAULT_OPTIONAL_STRING) {
      if (accessedCount > 0) continue;
      console.warn(`Env ${key} is optional and is not set.`);
    }
  }
  if (missingKeys.length > 0) {
    console.error(`ENV ${missingKeys.join(", ")} are missing and are required.`);
    process.exit(1);
  }

  const DISCORD_EPOCH = 1420070400000;
  // Check if the owner and server ids are snowflakes
  env.TEST_SERVERS.forEach((id) => {
    const snowflake = SnowflakeUtil.deconstruct(id);
    if (snowflake.timestamp < DISCORD_EPOCH) {
      // Discord Epoch (2015-01-01)
      console.error(`Env TEST_SERVERS contains an invalid snowflake: ${id}`);
      process.exit(1);
    }
  });

  env.OWNER_IDS.forEach((id) => {
    const snowflake = SnowflakeUtil.deconstruct(id);
    if (snowflake.timestamp < DISCORD_EPOCH) {
      // Discord Epoch (2015-01-01)
      console.error(`Env OWNER_IDS contains an invalid snowflake: ${id}`);
      process.exit(1);
    }
  });

  accessedCount++;
  return env;
}

const cachedEnvs = getter();
export default function () {
  return cachedEnvs;
}

export function isOptionalUnset(key: string) {
  return key === DEFAULT_OPTIONAL_STRING;
}
