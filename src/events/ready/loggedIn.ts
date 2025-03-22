import { ActivityType, type ActivityOptions, type Client, PresenceStatusData } from "discord.js";
import type { CommandKit } from "commandkit";
import { redisClient } from "../../Bot";
import Database from "../../utils/data/database";
import Settings, { SettingsType } from "../../models/Settings";
import { ActivityEnum } from "../../commands/utilities/settings";
import { debugMsg } from "../../utils/TinyUtils";
import TicTacToeSchema, { TicTacToeSchemaType } from "../../models/TicTacToeSchema";
import log from "../../utils/log";
const db = new Database();

export default async (c: Client<true>, client: Client<true>, handler: CommandKit) => {
  log(`Logged in as ${client.user?.tag}`);

  const db = new Database();
  const settings = (await db.findOne(Settings, { botId: client.user?.id }, true)) as SettingsType;

  if (settings && settings.activityText) {
    debugMsg(`Setting activity to ${settings.activityText} with type ${settings.activityType}`);
    client.user.setActivity({ type: settings.activityType, name: settings.activityText });
  }

  // Set last restart
  redisClient.set(`${client.user.id}-lastRestart`, Date.now().toString());
};
