import { Message, Client, ChannelType } from "discord.js";
import Database from "../../utils/data/database";
import { ThingGetter, debugMsg } from "../../utils/TinyUtils";
import RoleButtons from "../../models/RoleButtons";
import DontAtMeRole from "../../models/DontAtMeRole";
import BasicEmbed from "../../utils/BasicEmbed";

import fetchEnvs from "../../utils/FetchEnvs";
import { redisClient } from "../../Bot";
import { debug, error } from "console";
import log from "../../utils/log";
const env = fetchEnvs();

/**
 *
 * @param {Message} message
 * @param {Client} client
 * @returns
 */
export default async (message: Message, client: Client<true>) => {
  if (message.author.bot) return;
  if (message.mentions.users.size < 1) return;
  if (message.channel.type === ChannelType.DM) return;
  if (message.mentions.users.has(message.author.id) && message.mentions.users.size === 1) return;

  const db = new Database();
  const guildId = message.guild!.id; // This is safe because we check for DMs above
  const fetchedRole = await db.findOne(DontAtMeRole, { guildId: guildId }, true);
  debugMsg(`Fetched role ${fetchedRole}`);

  // If the role is not found, we can safely assume that the feature is not enabled so we cache this for faster response times
  if (!fetchedRole) {
    redisClient.set("DontAtMeRole:guildId:" + guildId, "false");
    return false;
  }

  const roleId = fetchedRole.roleId;
  const getter = new ThingGetter(client);
  debugMsg(`Getting guild ${guildId}`);
  const guild = await getter.getGuild(guildId);
  if (!guild) {
    log.error("Guild not found " + guildId);
    return false;
  }
  const role = guild.roles.cache.get(roleId);

  if (!role) {
    log.info("Don't @ Me Role is setup but not found " + roleId);
    return false;
  }
  var hasRole = false;
  message.mentions.users.forEach((user) => {
    const member = guild.members.cache.get(user.id);
    if (!member) return;
    if (member.roles.cache.has(roleId)) {
      if (env.OWNER_IDS.includes(message.author.id)) {
        message.react("<:pepewtf:1183908617871700078>");
        return;
      }
      hasRole = true;
    }
  });
  if (!hasRole) return;
  message.reply({
    embeds: [
      BasicEmbed(client, "Hey!", `Please don't mention users who have the <@&${roleId}> role!`),
    ],
  });
  return true;
};
