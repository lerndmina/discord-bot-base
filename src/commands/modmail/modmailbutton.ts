import type { SlashCommandProps, CommandOptions } from "commandkit";
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { globalCooldownKey, setCommandCooldown, waitingEmoji } from "../../Bot";
import ButtonWrapper from "../../utils/ButtonWrapper";
import BasicEmbed from "../../utils/BasicEmbed";

export const data = new SlashCommandBuilder()
  .setName("modmailbutton")
  .setDescription("Setup buttons to trigger a modmail dm to the user")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to send the modmail button to")
      .setRequired(true)
  )
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
  userPermissions: ["ManageMessages"],
};

export const MODMAIL_BUTTON_ID = "modmail-button-";

export async function run({ interaction, client, handler }: SlashCommandProps) {
  await interaction.reply({ content: waitingEmoji, ephemeral: true });

  const channel = interaction.options.getChannel("channel")! as TextChannel;

  if (channel.type !== ChannelType.GuildText)
    return interaction.editReply("You can't send a modmail button to a non text channel, silly!");

  const buttons = ButtonWrapper([
    new ButtonBuilder()
      .setCustomId(MODMAIL_BUTTON_ID + interaction.id)
      .setLabel("Open Modmail")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📬"),
    // new ButtonBuilder() // Well fuck me I guess, the dm channel is per user. Thanks Discord
    //   .setLabel("Go to Modmail")
    //   .setStyle(ButtonStyle.Link)
    //   .setURL("https://discord.com/channels/@me/" + client.user.dmChannel?.id)
    //   .setEmoji("💨"),
  ]);

  await channel.send({
    content: "",
    components: buttons,
    embeds: [
      BasicEmbed(
        client,
        "Modmail",
        `Click the button below to open a modmail thread and contact staff.\nAlternatively, you can simply send me a DM and I'll open a modmail thread for you.`
      ),
    ],
  });

  return interaction.editReply({
    content: `Modmail button has been sent to <#${channel.id}>`,
  });
}
