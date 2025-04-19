import {
  MessageType,
  MessageFlags,
  ActivityType,
  Message,
  Client,
  User,
  ButtonInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  ThreadAutoArchiveDuration,
  ThreadChannel,
  MessageComponentInteraction,
  InteractionResponse,
  CollectorFilter,
  BaseInteraction,
  Guild,
  ForumChannel,
  Snowflake,
  EmbedBuilder,
} from "discord.js";
import { ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import Modmail from "../../models/Modmail";
import ModmailConfig from "../../models/ModmailConfig";
import ButtonWrapper from "../../utils/ButtonWrapper";
import { redisClient, removeMentions, waitingEmoji } from "../../Bot";
import {
  debugMsg,
  getDiscordDate,
  isVoiceMessage,
  postWebhookToThread,
  prepModmailMessage,
  sleep,
  ThingGetter,
  TimeType,
} from "../../utils/TinyUtils";
import Database from "../../utils/data/database";
import { Url } from "url";
import FetchEnvs from "../../utils/FetchEnvs";
import { debug } from "console";
import log from "../../utils/log";
import { tryCatch } from "../../utils/trycatch";
import ModmailBanModel from "../../models/ModmailBans";
import ms from "ms";
const env = FetchEnvs();

const MAX_TITLE_LENGTH = 50;

export default async function (message: Message, client: Client<true>) {
  if (message.author.bot) return;
  const user = message.author;

  const { data, error } = await tryCatch(
    (async () => {
      if (message.guildId) {
        if (message.channel instanceof ThreadChannel) {
          if (isVoiceMessage(message)) {
            await message.reply("I don't support voice messages in modmail threads.");
            return;
          }

          await handleReply(message, client, user);
        }
      } else {
        await handleDM(message, client, user);
      }

      return { data: "Success" };
    })()
  );

  if (error) {
    await message.reply({
      embeds: [
        BasicEmbed(
          client,
          "Modmail ERROR",
          `An unhandled error occured while trying to process your message. Please contact the bot developer. I've logged the error for them.\n\nI just prevented the entire bot from crashing. This should never have happened lmao.\nHere's the error: \`\`\`${error}\`\`\``,
          undefined,
          "Red"
        ),
      ],
    });
    log.error(error);
  }
}

async function handleDM(message: Message, client: Client<true>, user: User) {
  const finalContent = await prepModmailMessage(client, message, 2000);
  if (!finalContent) return;

  const db = new Database();
  const requestId = message.id;
  const mail = await db.findOne(Modmail, { userId: user.id }, true);
  const customIds = [`create-${requestId}`, `cancel-${requestId}`];
  if (!mail) {
    const banned = await db.findOne(ModmailBanModel, { userId: user.id });
    if (banned) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Modmail")
            .setDescription(
              `You are banned from using modmail ${
                banned.permanent
                  ? "permanently"
                  : `until ${getDiscordDate(banned.expiresAt, TimeType.FULL_LONG)}`
              }.`
            )
            .setColor("Red")
            .setFooter({
              text: "I'd normally say you can DM me for support. Sucks to be you I guess.",
            }),
        ],
      });
    }
    await newModmail(customIds, message, finalContent, user, client);
  } else {
    await sendMessage(mail, message, finalContent, client);
  }
}

async function newModmail(
  customIds: string[],
  message: Message,
  messageContent: string,
  user: User,
  client: Client<true>
) {
  // Check if the message is longer than 50 characters
  const minCharacters = 50;
  if (messageContent.length < minCharacters && !messageContent.includes("--force")) {
    const deleteTime = 30 * 1000;
    const discordDeleteTime = new Date(Date.now() + deleteTime);
    message.react("🚫");

    // If the message is too short, send a warning and return
    const earlyreply = message.reply({
      embeds: [
        BasicEmbed(
          client,
          "Modmail",
          `Your message is too short to open a modmail ticket. Please send a message longer than ${minCharacters} characters. Please make sure to include as much detail about your issue as possible. If you would like to temporarily override this check please include \`--force\` at the end of your message.\n\nThis message will delete ${getDiscordDate(
            discordDeleteTime,
            TimeType.RELATIVE
          )} seconds.`,
          undefined,
          "Red"
        ),
      ],
    });
    earlyreply.then((msg) => {
      setTimeout(() => {
        msg.delete();
      }, 30 * 1000);
    });
    return;
  } else if (messageContent.includes("--force")) {
    // If the message contains --force, remove it from the message
    messageContent = messageContent.replace("--force", "").trim();
    await message.reply(
      `-# - You have used the --force flag. This will override the message length check. If you do not provide enough detail staff may not be able to help you. Please make sure to include as much detail about your issue as possible.`
    );
  }

  const buttons = [
    new ButtonBuilder()
      .setCustomId(customIds[0])
      .setLabel("Create Modmail")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(customIds[1]).setLabel("Cancel").setStyle(ButtonStyle.Danger),
  ];

  const reply = await message.reply({
    content: "",
    embeds: [
      BasicEmbed(
        client,
        "Modmail",
        "Would you like to create a modmail thread?",
        undefined,
        "Random"
      ),
    ],
    components: ButtonWrapper(buttons),
  });

  const buttonFilter: CollectorFilter<[MessageComponentInteraction]> = (
    interaction: BaseInteraction
  ) => {
    if (interaction instanceof ButtonInteraction) {
      return customIds.includes(interaction.customId);
    }
    return false;
  };
  const collector = reply.createMessageComponentCollector({
    filter: buttonFilter,
    time: ms("5min"),
  });

  /**
   * @param {ButtonInteraction} i
   */
  collector.on("collect", async (i) => {
    const orignalMsg = await i.update({ content: waitingEmoji, components: [], embeds: [] });

    if (i.customId === customIds[1]) {
      // Cancel button clicked
      await orignalMsg.delete();
      return;
    }

    // Create button clicked
    // TODO: Look up which servers the user and bot are in that both have modmail enabled
    const sharedGuilds: Guild[] = [];
    const cachedGuilds = client.guilds.cache;
    for (const [, guild] of cachedGuilds) {
      await guild.members
        .fetch(i.user)
        .then(() => sharedGuilds.push(guild))
        .catch((error) => log.info(error));
    }
    const stringSelectMenuID = `guildList-${i.id}`;
    var guildList = new StringSelectMenuBuilder()
      .setCustomId(stringSelectMenuID)
      .setPlaceholder("Select a server")
      .setMinValues(1)
      .setMaxValues(1);
    var addedSomething = false;
    for (var guild of sharedGuilds) {
      const db = new Database();
      const config = await db.findOne(ModmailConfig, { guildId: guild.id });
      if (config) {
        addedSomething = true;
        guildList.addOptions({
          label: guild.name,
          value: JSON.stringify({
            guild: config.guildId,
            channel: config.forumChannelId,
            staffRoleId: config.staffRoleId,
          }),
        });
      }
    }

    const cancelListEntryId = `cancel-${i.id}`;
    guildList.addOptions({
      label: "Cancel",
      value: cancelListEntryId,
      description: "Cancel the modmail thread creation.",
      emoji: "❌",
    });

    if (!addedSomething) {
      await orignalMsg.edit({
        content: "",
        components: [],
        embeds: [
          BasicEmbed(
            client,
            "Modmail",
            "There are no servers that have modmail enabled that you and I are both in.",
            undefined,
            "Random"
          ),
        ],
      });
      return;
    }
    const row = new ActionRowBuilder().addComponents(guildList);
    await orignalMsg.edit({
      embeds: [
        BasicEmbed(
          client,
          "Modmail",
          "Select a server to open a modmail thread in.",
          undefined,
          "Random"
        ),
      ],
      content: "",
      components: [row as any],
    });

    await serverSelectedOpenModmailThread(orignalMsg, stringSelectMenuID, message);
    return;
  });

  collector.on("end", async (collected) => {
    if (collected.size === 0) {
      const failedReply = await reply.edit({
        content: "",
        embeds: [
          BasicEmbed(
            client,
            "Modmail",
            "You took too long to respond. Please try again.\n\nIf you want to open a modmail thread, just DM me again!\nThis message will delete in 15 seconds.",
            undefined,
            "Red"
          ),
        ],
        components: [],
      });

      await sleep(ms("15s"));
      if (failedReply) {
        tryCatch(failedReply.delete());
      }
    }
  });

  async function serverSelectedOpenModmailThread(
    reply: InteractionResponse,
    stringSelectMenuID: string,
    message: Message
  ) {
    const selectMenuFilter = (i: MessageComponentInteraction) => i.customId === stringSelectMenuID;
    const collector = reply.createMessageComponentCollector({
      filter: selectMenuFilter,
      time: ms("5min"),
    });

    collector.on("collect", async (collectedInteraction) => {
      const i = collectedInteraction as StringSelectMenuInteraction;

      if (i.values[0].startsWith("cancel-")) {
        await i.update({
          content: "",
          embeds: [
            BasicEmbed(
              client,
              "Modmail",
              "Cancelled modmail thread creation.",
              undefined,
              "Random"
            ),
          ],
          components: [],
        });
        return;
      }

      const value = JSON.parse(i.values[0]);
      const guildId = value.guild as Snowflake;
      const channelId = value.channel as Snowflake;
      const staffRoleId = value.staffRoleId as Snowflake;
      await reply.edit({ content: waitingEmoji, components: [], embeds: [] });

      const getter = new ThingGetter(client);
      const guild = await getter.getGuild(guildId);
      const member = await getter.getMember(guild, i.user.id);
      const memberName = member.nickname || member.user.displayName;

      const channel = (await getter.getChannel(channelId)) as unknown as ForumChannel; // TODO: This is unsafe
      const threads = channel.threads;
      const noMentionsMessage = removeMentions(message.content);
      const { data: thread, error: threadCreateError } = await tryCatch(
        threads.create({
          name: `${
            noMentionsMessage.length >= MAX_TITLE_LENGTH
              ? `${noMentionsMessage.slice(0, MAX_TITLE_LENGTH)}...`
              : noMentionsMessage
          } - ${memberName}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          message: {
            content: `Modmail thread for ${memberName} | ${i.user.id} | <@${
              i.user.id
            }>\n\n Original message: ${noMentionsMessage}${
              member.pending ? "\n\nUser has not fully joined the guild." : ""
            }`,
          },
        })
      );

      if (threadCreateError) {
        log.error(threadCreateError);
        return reply.edit({
          content: "",
          embeds: [
            BasicEmbed(
              client,
              "Modmail",
              `An error occured while trying to create a modmail thread. Please contact the bot developer. I've logged the error for them.\n\nHere's the error: \`\`\`${threadCreateError}\`\`\``,
              undefined,
              "Red"
            ),
          ],
          components: [],
        });
      }

      const db = new Database();

      // Get the ModmailConfig for the server to use its webhook
      const config = await db.findOne(ModmailConfig, { guildId: guildId });
      if (!config || !config.webhookId || !config.webhookToken) {
        // If there's no webhook configured yet, create one and update the config (this allows for seamless migration)
        log.info("Creating new webhook for modmail config");
        const webhook = await channel.createWebhook({
          name: "Modmail System",
          avatar: client.user.displayAvatarURL(),
          reason: "Modmail system webhook for relaying user messages.",
        });

        await db.findOneAndUpdate(
          ModmailConfig,
          { guildId: guildId },
          {
            webhookId: webhook.id,
            webhookToken: webhook.token,
          },
          { new: true, upsert: true }
        );
      }

      thread.send({
        content: `<@&${staffRoleId}>`,
        embeds: [
          BasicEmbed(
            client,
            "Modmail",
            `Hey! ${memberName} has opened a modmail thread!`,
            undefined,
            "Random"
          ),
        ],
      });

      // Create new modmail entry with user avatar and display name
      await db.findOneAndUpdate(
        Modmail,
        { userId: i.user.id },
        {
          guildId: guildId,
          forumThreadId: thread.id,
          forumChannelId: channelId,
          userId: i.user.id,
          userAvatar: i.user.displayAvatarURL(),
          userDisplayName: memberName,
        },
        {
          upsert: true,
          new: true,
        }
      );

      reply.edit({
        content: ``,
        embeds: [
          BasicEmbed(
            client,
            "Modmail",
            `Successfully created a modmail thread in **${guild.name}**!\n\nWe will get back to you as soon as possible. While you wait, why not grab a hot beverage!\n\nOnce we have solved your issue, you can use \`/modmail close\` to close the thread. If you need to send us more information, just send it here!\n\nIf you want to add more information to your original message, just send it here!`,
            undefined,
            "Random"
          ),
        ],
        components: [],
      });
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        const failedReply = await reply.edit({
          content: "",
          embeds: [
            BasicEmbed(
              client,
              "Modmail",
              "You took too long to respond. Please try again.\n\nIf you want to open a modmail thread, just DM me again!\nThis message will delete in 15 seconds.",
              undefined,
              "Red"
            ),
          ],
          components: [],
        });

        await sleep(ms("15s"));
        if (failedReply) {
          tryCatch(failedReply.delete());
        }
      }
    });
  }
}

/**
 * @param {Modmail} mail
 * @param {Message} message
 * @param {Client} client
 */
async function sendMessage( // Send a message from dms to the modmail thread
  mail: any,
  message: Message,
  messageContent: string,
  client: Client<true>
) {
  const cleanMessageContent = removeMentions(messageContent);
  const getter = new ThingGetter(client);
  try {
    const guild = await getter.getGuild(mail.guildId);
    const thread = (await getter.getChannel(mail.forumThreadId)) as ThreadChannel;

    // Get the webhook from the ModmailConfig instead of the individual modmail
    const db = new Database();
    const config = await db.findOne(ModmailConfig, { guildId: mail.guildId });

    if (!config || !config.webhookId || !config.webhookToken) {
      // If there's no webhook in config, fall back to normal message
      return thread.send(
        `${message.author.username} says: ${cleanMessageContent}\n\n\`\`\`No webhook found in ModmailConfig, please recreate the modmail setup.\`\`\``
      );
    }

    const webhook = await client.fetchWebhook(config.webhookId, config.webhookToken);

    // Send message with the user's avatar and username from the stored data or current values
    await webhook.send({
      content: cleanMessageContent,
      threadId: thread.id,
      username: mail.userDisplayName || message.author.displayName,
      avatarURL: mail.userAvatar || message.author.displayAvatarURL(),
    });

    // React to the message to indicate it was sent
    await message.react("📨");

    // Update the user's avatar and display name if they're not set or have changed
    if (!mail.userAvatar || !mail.userDisplayName) {
      await db.findOneAndUpdate(
        Modmail,
        { userId: message.author.id },
        {
          userAvatar: message.author.displayAvatarURL(),
          userDisplayName: message.author.displayName,
        },
        { new: true, upsert: true }
      );
    }
  } catch (error) {
    log.error(error as string);
    return message.react("<:error:1182430951897321472>");
  }
  return message.react("📨");
}

async function handleReply(message: Message, client: Client<true>, staffUser: User) {
  const db = new Database();
  const thread = message.channel;
  const messages = await thread.messages.fetch();

  // const lastMessage = messages.last()!; // Check that the bot is the one who opened the thread.
  // if (lastMessage.author.id !== client.user.id) return;
  // ^ This caused ratelimiting when checking if the bot owned the channel

  const mail = await db.findOne(Modmail, { forumThreadId: thread.id });
  if (!mail) {
    // This is not a modmail thread so we tell the redis to cache that fact
    return redisClient.set(`${env.MODMAIL_TABLE}:forumThreadId:${thread.id}`, "false");
  }
  const getter = new ThingGetter(client);
  const guild = await getter.getGuild(mail.guildId);
  if (message.content.startsWith(".")) {
    // TODO move this to an env var
    return message.react("🕵️"); // Messages starting with . are staff only
  }
  const finalContent = removeMentions((await prepModmailMessage(client, message, 1024)) || "");
  if (!finalContent) return;

  debugMsg(
    "Sending message to user " +
      mail.userId +
      " in guild " +
      mail.guildId +
      " from " +
      staffUser.globalName
  );

  (await getter.getUser(mail.userId)).send({
    // embeds: [
    //   BasicEmbed(client, "Modmail Reply", `*`, [
    //     {
    //       name: `${getter.getMemberName(await getter.getMember(guild, staffUser.id))} (Staff):`,
    //       value: `${finalContent}`,
    //       inline: false,
    //     },
    //   ]),
    // ],
    content:
      `### ${getter.getMemberName(await getter.getMember(guild, staffUser.id))} Resonded:` +
      `\n${finalContent}` +
      `\n-# This message was sent by a staff member of **${guild.name}** in reply to your modmail thread.` +
      `\n-# If you want to close this thread, just send \`/modmail close\` here`,
  });

  debugMsg("Sent message to user" + mail.userId + " in guild " + mail.guildId);

  return message.react("📨");
}
