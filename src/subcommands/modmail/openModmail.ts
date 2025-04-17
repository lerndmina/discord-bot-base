import type { SlashCommandProps, CommandOptions } from "commandkit";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ForumChannel,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from "discord.js";
import { globalCooldownKey, setCommandCooldown, waitingEmoji } from "../../Bot";
import ButtonWrapper from "../../utils/ButtonWrapper";
import BasicEmbed from "../../utils/BasicEmbed";
import { ThingGetter } from "../../utils/TinyUtils";
import Database from "../../utils/data/database";
import ModmailConfig from "../../models/ModmailConfig";
import Modmail from "../../models/Modmail";
import FetchEnvs from "../../utils/FetchEnvs";

export const openModmailOptions: CommandOptions = {
  devOnly: false,
  deleted: true,
  userPermissions: ["ManageMessages", "KickMembers", "BanMembers"], // This is a mod command
};

export default async function ({ interaction, client, handler }: SlashCommandProps) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply("This command can only be used in a server");

  const user = interaction.options.getUser("user");
  if (!user) return interaction.reply("Please provide a user to open a modmail thread for");
  if (user.bot) return interaction.reply("You cannot open a modmail thread for a bot");
  const reason = interaction.options.getString("reason");
  const getter = new ThingGetter(client);
  const targetMember = await getter.getMember(guild, user.id);
  if (!targetMember) return interaction.reply("The user is not in the server");
  const db = new Database();
  const modmailConfig = await db.findOne(ModmailConfig, { guildId: guild.id });
  if (!modmailConfig)
    return interaction.reply(
      "Modmail is not set up in this server, please run the setup command first"
    );

  const channel = (await getter.getChannel(modmailConfig.forumChannelId)) as ForumChannel;
  if (!channel || !channel.threads)
    return interaction.reply("The modmail channel is not set up properly");

  const modmailData = await db.findOne(Modmail, { userId: targetMember.id });
  if (modmailData) return interaction.reply("A modmail thread is already open for this user");

  // Get the user's thread
  const thread = await channel.threads.create({
    name: reason ? `${reason.substring(0, 50)}...` : `Modmail - ${user.tag}`,
    autoArchiveDuration: 60,
    message: {
      content: `Modmail thread opened for ${user.tag} (<@${user.id}>) by staff member ${interaction.user.tag} (${interaction.user.id})\n\nReason: ${reason}`,
    },
  });

  const webhook = await channel.createWebhook({
    name: targetMember.nickname || targetMember.displayName,
    avatar: targetMember.user.displayAvatarURL(),
    reason: `Modmail thread opened for ${user.tag} (${user.id}) by staff member ${interaction.user.tag} (${interaction.user.id})\n\nReason: ${reason}`,
  });

  const newModmailData = await db.findOneAndUpdate(
    Modmail,
    { userId: targetMember.id },
    {
      guildId: guild.id,
      forumThreadId: thread.id,
      forumChannelId: channel.id,
      webhookId: webhook.id,
      webhookToken: webhook.token,
    },
    { upsert: true, new: true }
  );

  const dmChannel = await targetMember.createDM();
  try {
    await dmChannel.send({
      embeds: [
        BasicEmbed(
          client,
          "Modmail Thread Opened",
          `Staff have opened a modmail thread for you. Please respond here to communicate with staff.`,
          reason ? [{ name: "Reason", value: reason, inline: false }] : [],
          "Aqua"
        ),
      ],
    });
    setCommandCooldown(globalCooldownKey(interaction.commandName), 60);
  } catch (error) {
    const env = FetchEnvs();
    await interaction.editReply(
      `I was unable to send a DM to the user, this modmail thread will be closed. Please contact the user manually.`
    );

    await db.deleteOne(Modmail, { userId: targetMember.id });
    await thread.delete();
    await webhook.delete();
    setCommandCooldown(globalCooldownKey(interaction.commandName), 15);
  }
  await interaction.editReply({
    content: `Modmail thread opened for ${user.tag} (${user.id})\n\nThe DM has been sent to the user successfully`,
    components: ButtonWrapper([
      new ButtonBuilder()
        .setLabel("Goto Thread")
        .setStyle(ButtonStyle.Link)
        .setEmoji("🔗")
        .setURL(thread.url),
    ]),
  });
}
