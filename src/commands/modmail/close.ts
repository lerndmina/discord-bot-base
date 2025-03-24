import { ChannelType, ForumChannel, SlashCommandBuilder, ThreadChannel } from "discord.js";
import BasicEmbed from "../../utils/BasicEmbed";
import Modmail from "../../models/Modmail";
import { waitingEmoji } from "../../Bot";
import { ThingGetter } from "../../utils/TinyUtils";
import Database from "../../utils/data/database";
import { CommandOptions, SlashCommandProps } from "commandkit";
import log from "../../utils/log";
import FetchEnvs from "../../utils/FetchEnvs";

const env = FetchEnvs();

export const data = new SlashCommandBuilder()
  .setName("close")
  .setDescription("Close a modmail thread")
  .setDMPermission(true)
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("The reason for closing the modmail thread")
      .setRequired(false)
  );

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
  // userPermissions: ["ManageMessages"],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
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

  await interaction.reply(waitingEmoji);

  const forumThread = (await getter.getChannel(mail.forumThreadId)) as ThreadChannel;
  try {
    const webhook = await client.fetchWebhook(mail.webhookId, mail.webhookToken);
    webhook.delete();
  } catch (error) {
    log.error("Webhook missing, probably already deleted.");
  }
  const embed = BasicEmbed(
    client,
    "Modmail Closed",
    `This modmail thread has been closed.\n\nReason: ${reason}\n\nYou can open a modmail by sending another message to the bot.`,
    undefined,
    "Red"
  );

  await forumThread.send({
    embeds: [embed],
  });

  const user = await getter.getUser(mail.userId);
  if (!user) return interaction.editReply("Mail user not found. This should never happen.");

  user.send({
    embeds: [embed],
  });
  try {
    await forumThread.setLocked(true, reason);
    await forumThread.setArchived(true, reason);
  } catch (error) {
    console.error(error);
    forumThread.send(
      "Failed to archive and lock thread, please do so manually.\nI'm probably missing permissions."
    );
  }

  const db = new Database();
  await db.deleteOne(Modmail, { forumThreadId: forumThread.id });
  await db.cleanCache(`${env.MONGODB_DATABASE}:${env.MODMAIL_TABLE}:userId:*`);
  await interaction.editReply("🎉 Successfully closed modmail thread!");
}
