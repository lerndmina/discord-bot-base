import { ChannelType, ForumChannel, SlashCommandBuilder, ThreadChannel } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import Modmail from "../../models/Modmail";
import { waitingEmoji } from "../../Bot";
import { ThingGetter } from "../../utils/TinyUtils";
import Database from "../../utils/data/database";
import { CommandOptions, SlashCommandProps } from "commandkit";
import log from "../../utils/log";
import FetchEnvs from "../../utils/FetchEnvs";
import { initialReply } from "../../utils/initialReply";
import { handleTag } from "../../events/messageCreate/gotMail";
import ModmailConfig from "../../models/ModmailConfig";
import { sendModmailCloseMessage } from "../../utils/ModmailUtils";
import ModmailCache from "../../utils/ModmailCache";

const env = FetchEnvs();

export default async function ({ interaction, client, handler }: SlashCommandProps) {
  if (!interaction.channel)
    return log.error("Request made to slash command without required values - close.ts");

  const getter = new ThingGetter(client);
  const reason = interaction.options.getString("reason") || "No reason provided";

  var mail = await Modmail.findOne({ forumThreadId: interaction.channel.id });
  if (!mail && interaction.channel.type === ChannelType.DM)
    mail = await Modmail.findOne({ userId: interaction.user.id });
  if (!mail) {
    return interaction.reply({
      embeds: [
        BasicEmbed(client, "‼️ Error", "This channel is not a modmail thread.", undefined, "Red"),
      ],
      ephemeral: true,
    });
  }

  await initialReply(interaction, true);

  // Determine if it's the user or a staff member closing the thread
  const isUser = mail.userId === interaction.user.id;
  const closedBy = isUser ? "User" : "Staff";
  const closedByName = isUser
    ? (await getter.getUser(mail.userId)).username
    : interaction.user.username;
  const forumThread = (await getter.getChannel(mail.forumThreadId)) as ThreadChannel;

  // Send closure message using consistent styling
  await sendModmailCloseMessage(client, mail, closedBy, closedByName, reason);

  const db = new Database();
  const config = interaction.guildId
    ? await ModmailCache.getModmailConfig(interaction.guildId, db)
    : null;
  // Now add the closed tag to the modmail thread
  if (config) {
    const forumChannel = (await getter.getChannel(config.forumChannelId)) as ForumChannel;
    await handleTag(null, config, db, forumThread, forumChannel);
  }

  try {
    await forumThread.setLocked(true, `${closedBy} closed: ${reason}`);
    await forumThread.setArchived(true, `${closedBy} closed: ${reason}`);
  } catch (error) {
    console.error(error);
    forumThread.send(
      "Failed to archive and lock thread, please do so manually.\nI'm probably missing permissions."
    );
  }

  await db.deleteOne(Modmail, { forumThreadId: forumThread.id });
  await db.cleanCache(`${env.MONGODB_DATABASE}:${env.MODMAIL_TABLE}:userId:*`);

  await interaction.editReply(
    `🎉 Successfully closed modmail thread! (Closed by ${closedBy.toLowerCase()})`
  );
}
