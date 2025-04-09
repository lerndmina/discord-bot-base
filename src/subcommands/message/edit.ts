import { SlashCommandProps } from "commandkit";
import { ThingGetter } from "../../utils/TinyUtils";
import { messageAttachmentProcessor } from "../../commands/utilities/message";
import { MessageEditOptions } from "discord.js";

export default async function ({ interaction, client, handler }: SlashCommandProps) {
  const url = new URL(interaction.options.getString("url")!);
  const attachment = interaction.options.getAttachment("data");
  const shortLink = interaction.options.getString("short-link");
  const removeComponents = interaction.options.getBoolean("remove-components", false);

  const getter = new ThingGetter(client);
  const message = await getter.getMessageFromUrl(url);
  if (!message) {
    throw new Error("Message not found.");
  }

  const newMessageContent = (await messageAttachmentProcessor(
    attachment!,
    shortLink!
  )) as MessageEditOptions;

  if (removeComponents) {
    newMessageContent.components = [];
  } else {
    newMessageContent.components = message.components ? message.components : [];
  }

  if (!newMessageContent.embeds) newMessageContent.embeds = [];

  try {
    await message.edit(newMessageContent);
  } catch (error) {
    throw new Error(`Failed to edit message: ${error}`);
  }
  return interaction.editReply(`Edited message ${message.url}`);
}
