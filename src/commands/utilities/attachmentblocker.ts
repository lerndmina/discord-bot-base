import { ButtonBuilder, ButtonStyle, GuildTextBasedChannel, SlashCommandBuilder } from "discord.js";
import { CommandOptions, SlashCommandProps } from "commandkit";
import AttachmentBlocker, {
  BlockType,
  AttachmentType,
  AttachmentBlockerType,
} from "../../models/AttachmentBlocker";
import Database from "../../utils/data/database";
import { waitingEmoji } from "../../Bot";
import BasicEmbed from "../../utils/BasicEmbed";
import ButtonWrapper from "../../utils/ButtonWrapper";

export const data = new SlashCommandBuilder()
  .setName("attachmentblocker")
  .setDescription("block or allow certain attachment types in a channel")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to block/allow attachments in")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("The type of attachment to block/allow")
      .setRequired(true)
      .addChoices(
        { name: "image", value: "image" },
        { name: "video", value: "video" },
        { name: "audio", value: "audio" },
        { name: "file", value: "file" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("blocktype")
      .setDescription("The type of block to apply")
      .setRequired(true)
      .addChoices(
        { name: "whitelist", value: "whitelist" },
        { name: "blacklist", value: "blacklist" }
      )
  )
  .addBooleanOption((option) =>
    option.setName("clear").setDescription("Clear all attachment blocks in the channel")
  )
  .setDMPermission(false);

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
  botPermissions: ["ManageMessages"],
  userPermissions: ["ManageChannels", "ManageMessages"],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const interactionMessage = await interaction.reply({ content: waitingEmoji, ephemeral: false });

  try {
    const channel = (interaction.options.getChannel("channel") ||
      interaction.channel) as GuildTextBasedChannel;

    const db = new Database();

    // Handle clear option first
    if (interaction.options.getBoolean("clear")) {
      await db.findOneAndDelete(AttachmentBlocker, { channelId: channel.id });
      return interaction.editReply({
        content: "",
        embeds: [
          BasicEmbed(
            client,
            "Attachment Blocker",
            `Successfully cleared all attachment blocks in ${channel}`
          ),
        ],
      });
    }

    // Get attachment type and validate
    const type = interaction.options.getString("type") as AttachmentType;
    if (!Object.values(AttachmentType).includes(type as AttachmentType)) {
      return interaction.editReply({
        content: `Invalid attachment type: ${type}. Must be one of: ${Object.values(
          AttachmentType
        ).join(", ")}`,
      });
    }

    // Get block type and validate
    const blockType = interaction.options.getString("blocktype") as BlockType;
    if (!Object.values(BlockType).includes(blockType as BlockType)) {
      return interaction.editReply({
        content: `Invalid block type: ${blockType}. Must be one of: ${Object.values(BlockType).join(
          ", "
        )}`,
      });
    }

    // Deleteme button component
    const buttons = ButtonWrapper([
      new ButtonBuilder()
        .setCustomId("deleteme-" + interactionMessage.id)
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️"),
    ]);

    // Check if config exists for this channel
    const existingConfig = await db.findOne<AttachmentBlockerType>(AttachmentBlocker, {
      channelId: channel.id,
    });

    let result;
    if (existingConfig) {
      // Update existing configuration
      let attachmentTypes = [...existingConfig.attachmentTypes];

      // Check if type already exists
      if (attachmentTypes.includes(type)) {
        return interaction.editReply({
          content: "",
          embeds: [
            BasicEmbed(
              client,
              "Attachment Blocker",
              `${type} is already ${
                blockType === BlockType.WHITELIST ? "whitelisted" : "blacklisted"
              } in ${channel}`
            ),
          ],
          components: [buttons],
        });
      }

      // Add new type
      attachmentTypes.push(type);

      result = await db.findOneAndUpdate<AttachmentBlockerType>(
        AttachmentBlocker,
        { channelId: channel.id },
        {
          attachmentTypes,
          blockType, // Update the block type
          createdBy: interaction.user.id,
        }
      );
    } else {
      // Create new configuration
      result = await db.findOneAndUpdate<AttachmentBlockerType>(
        AttachmentBlocker,
        { channelId: channel.id },
        {
          channelId: channel.id,
          attachmentTypes: [type],
          blockType,
          createdBy: interaction.user.id,
        },
        { upsert: true, new: true }
      );
    }

    return interaction.editReply({
      content: "",
      embeds: [
        BasicEmbed(
          client,
          "Attachment Blocker",
          `Successfully ${
            blockType === BlockType.WHITELIST ? "whitelisted" : "blacklisted"
          } ${type} attachments in ${channel}`,
          [
            {
              name: "Configuration",
              value: `**Mode:** ${result?.blockType}\n**Types:** ${result?.attachmentTypes.join(
                ", "
              )}`,
              inline: false,
            },
          ]
        ),
      ],
      components: [buttons],
    });
  } catch (error) {
    console.error("Error in attachmentblocker command:", error);
    return interaction.editReply({
      content: "An error occurred while configuring attachment blocking. Please try again.",
    });
  }
}
