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
import ModmailCache from "../../utils/ModmailCache";
import ModmailConfig from "../../models/ModmailConfig";
import Modmail from "../../models/Modmail";
import FetchEnvs from "../../utils/FetchEnvs";
import { createModmailThread } from "../../utils/ModmailUtils";

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
  const reason = interaction.options.getString("reason") || "(no reason specified)";

  const getter = new ThingGetter(client);
  const targetMember = await getter.getMember(guild, user.id);
  if (!targetMember) return interaction.reply("The user is not in the server");

  const db = new Database();
  const modmailConfig = await ModmailCache.getModmailConfig(guild.id, db);
  if (!modmailConfig)
    return interaction.reply(
      "Modmail is not set up in this server, please run the setup command first"
    );

  const channel = (await getter.getChannel(modmailConfig.forumChannelId)) as ForumChannel;
  if (!channel || !channel.threads)
    return interaction.reply("The modmail channel is not set up properly");

  // All checks passed
  await interaction.reply({ content: waitingEmoji, ephemeral: true });

  // Use the centralized function to create the modmail thread
  const result = await createModmailThread(client, {
    guild,
    targetUser: user,
    targetMember,
    forumChannel: channel,
    modmailConfig,
    reason,
    openedBy: {
      type: "Staff",
      username: interaction.user.username,
      userId: interaction.user.id,
    },
  });

  if (!result?.success) {
    await interaction.editReply(`❌ ${result?.error || "Failed to create modmail thread"}`);
    return;
  }

  if (!result.dmSuccess) {
    await interaction.editReply(
      `I was unable to send a DM to the user, this modmail thread will be closed. Please contact the user manually.`
    );

    // Clean up the created thread and database entry
    if (result.thread) {
      await result.thread.delete();
    }
    if (result.modmail) {
      await db.deleteOne(Modmail, { _id: result.modmail._id });
    }
    setCommandCooldown(globalCooldownKey(interaction.commandName), 15);
    return;
  }

  setCommandCooldown(globalCooldownKey(interaction.commandName), 60);

  await interaction.editReply({
    content: `Modmail thread opened for ${user.tag} (${user.id})\n\nThe DM has been sent to the user successfully`,
    components: ButtonWrapper([
      new ButtonBuilder()
        .setLabel("Goto Thread")
        .setStyle(ButtonStyle.Link)
        .setEmoji("🔗")
        .setURL(result.thread!.url),
    ]),
  });
}
