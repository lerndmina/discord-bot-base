import { ButtonInteraction, ChannelType, Client, InteractionType } from "discord.js";
import Database from "../../utils/data/database";
import Modmail from "../../models/Modmail";
import ModmailConfig from "../../models/ModmailConfig";
import { ThingGetter } from "../../utils/TinyUtils";
import { handleTag } from "../messageCreate/gotMail";
import FetchEnvs from "../../utils/FetchEnvs";
import log from "../../utils/log";
import { sendModmailCloseMessage } from "../../utils/ModmailUtils";

const env = FetchEnvs();

export default async (interaction: ButtonInteraction, client: Client<true>) => {
  if (interaction.type !== InteractionType.MessageComponent) return false;
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("modmail_close_thread")) return false;

  const db = new Database();
  const getter = new ThingGetter(client);

  try {
    await interaction.deferReply({ ephemeral: true });

    // Find modmail by user ID (if in DMs) or by thread ID (if in thread)
    let modmail;

    if (interaction.channel?.type === 1) {
      // DM channel
      modmail = await db.findOne(Modmail, { userId: interaction.user.id });
    } else if (interaction.channel?.isThread()) {
      modmail = await db.findOne(Modmail, { forumThreadId: interaction.channel.id });
    }

    if (!modmail) {
      return interaction.editReply({
        content: "❌ Could not find an associated modmail thread.",
      });
    }

    // Check if user is allowed to close (either the thread owner or staff)
    const isOwner = modmail.userId === interaction.user.id;
    const interactionMember = await getter.getMember(interaction.guild, interaction.user.id);
    const isStaff = interactionMember?.permissions.has("ManageMessages");
    if (!isOwner && !isStaff) {
      return interaction.editReply({
        content: "❌ You don't have permission to close this modmail thread.",
      });
    }

    const closedBy = isOwner ? "User" : "Staff";
    const closedByName = interaction.user.username;
    const reason = "Closed via inactivity button";

    // Get the forum thread
    const forumThread = await getter.getChannel(modmail.forumThreadId);
    if (!forumThread || !("setLocked" in forumThread)) {
      return interaction.editReply({
        content: "❌ Could not access the modmail thread.",
      });
    } // Send closure message using consistent styling
    await sendModmailCloseMessage(client, modmail, closedBy, closedByName, reason);

    // Update tags to closed
    const config = await db.findOne(ModmailConfig, { guildId: modmail.guildId });
    if (config) {
      const forumChannel = await getter.getChannel(config.forumChannelId);
      if (forumChannel.type === ChannelType.GuildForum) {
        await handleTag(null, config, db, forumThread, forumChannel);
      }
    }

    // Lock and archive thread
    try {
      await forumThread.setLocked(true, `${closedBy} closed via button: ${reason}`);
      await forumThread.setArchived(true, `${closedBy} closed via button: ${reason}`);
    } catch (error) {
      log.warn(`Failed to lock/archive thread ${modmail.forumThreadId}:`, error);
    }

    // Remove from database
    await db.deleteOne(Modmail, { _id: modmail._id });
    await db.cleanCache(`${env.MONGODB_DATABASE}:${env.MODMAIL_TABLE}:userId:*`);

    await interaction.editReply({
      content: `✅ Modmail thread closed successfully! (Closed by ${closedBy.toLowerCase()})`,
    });

    return true;
  } catch (error) {
    log.error("Error in modmail close button handler:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred while closing the modmail thread.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "❌ An error occurred while closing the modmail thread.",
      });
    }

    return true;
  }
};
