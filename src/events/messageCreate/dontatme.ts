import { Message, Client, ChannelType } from "discord.js";
import Database from "../../utils/data/database";
import { ThingGetter, debugMsg, sleep } from "../../utils/TinyUtils";
import RoleButtons from "../../models/RoleButtons";
import DontAtMeRole from "../../models/DontAtMeRole";
import BasicEmbed from "../../utils/BasicEmbed";

import fetchEnvs, { DEFAULT_OPTIONAL_STRING } from "../../utils/FetchEnvs";
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
  // if (message.mentions.users.has(message.author.id) && message.mentions.users.size === 1) return; // !Commented out for debugging purposes

  const db = new Database();
  const guildId = message.guild!.id; // This is safe because we check for DMs above
  const fetchedRole = await db.findOne(DontAtMeRole, { guildId: guildId }, true);
  debugMsg(`Fetched role ${fetchedRole}`);
  if (!fetchedRole) {
    debugMsg({ message: "No Dont @ Me Role found", guildId });
    return false;
  }

  const dontAtMeRoleId = fetchedRole.roleId;
  const getter = new ThingGetter(client);
  debugMsg(`Getting guild ${guildId}`);
  const guild = await getter.getGuild(guildId);
  if (!guild) {
    log.error("Guild not found " + guildId);
    return false;
  }
  const dontAtMeRole = await getter.getRole(guild, dontAtMeRoleId);

  if (!dontAtMeRole) {
    log.info("Don't @ Me Role is setup but not found " + dontAtMeRoleId);
    return false;
  }
  var isUserImmune = false;
  var isStaffMentioned = false;
  await message.mentions.users.forEach(async (user) => {
    const mentionMember = await getter.getMember(guild, user.id);
    const authorMember = await getter.getMember(guild, message.author.id);
    if (!mentionMember) return;
    if (mentionMember.roles.cache.has(dontAtMeRoleId)) {
      if (env.OWNER_IDS.includes(message.author.id)) {
        isUserImmune = true;
        debugMsg({ message: "Owner is immune to dontatmerole", userId: message.author.id });
      } else if (authorMember && authorMember.roles.cache.has(env.STAFF_ROLE)) {
        isUserImmune = true;
        debugMsg({ message: "Staff are immune to dontatmerole", userId: message.author.id });
      }
      if (mentionMember.roles.cache.has(env.STAFF_ROLE)) {
        isStaffMentioned = true;
        debugMsg({ message: "Staff are mentioned", userId: user.id });
      }
    }
  });
  if (isUserImmune) return;
  else {
    let replyString = `Hey there!\n\nOne of the users mentioned in your message have requested not to be mentioned. Please respect their wishes and avoid mentioning them in the future.`;
    if (env.STAFF_ROLE !== DEFAULT_OPTIONAL_STRING && isStaffMentioned) {
      replyString =
        replyString +
        `\n\n👀 Oop! Looks like you mentioned a staff member. If you need help, please DM this bot to open a modmail ticket. Thank you!`;
    }

    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);
    const deleteInSeconds = 15;
    const deleteTimeInFutureSeconds = nowSeconds + deleteInSeconds;

    replyString =
      replyString + `\n\nThis message will be deleted <t:${deleteTimeInFutureSeconds}:R>.`;
    const embed = BasicEmbed(client, "Dont @ Me", replyString);
    const sentMessage = await message.reply({
      embeds: [embed],
      allowedMentions: { repliedUser: true, parse: [] },
    });
    await sleep(1000 * deleteInSeconds - 1000); // Delete one second early
    try {
      await sentMessage.delete();
    } catch (error) {
      log.error({ message: "Error deleting dont @ me message", error });
    }
  }
};
