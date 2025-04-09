import { SlashCommandProps } from "commandkit";
import { ThingGetter } from "../../utils/TinyUtils";
import { MessageProcessor } from "../../utils/MessageProcessorService";
import CommandError from "../../utils/interactionErrors/CommandError";
import { MessageEditOptions } from "discord.js";

export default async function ({ interaction, client }: SlashCommandProps) {
  try {
    const messageUrl = interaction.options.getString("url", true);
    const url = new URL(messageUrl);

    const attachment = interaction.options.getAttachment("data");
    const shortLink = interaction.options.getString("short-link");
    const removeComponents = interaction.options.getBoolean("remove-components") ?? false;

    const getter = new ThingGetter(client);
    const message = await getter.getMessageFromUrl(url);

    if (!message) {
      throw new Error("Message not found");
    }

    const result = await MessageProcessor.processMessage(attachment, shortLink);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Create properly typed edit data
    const editData: MessageEditOptions = {
      content: result.data?.content,
      embeds: result.data?.embeds ?? [],
      components: removeComponents ? [] : message.components ?? [],
      allowedMentions: result.data?.allowedMentions,
      files: result.data?.files,
    };

    await message.edit(editData);
    await interaction.editReply({
      content: `Message edited successfully`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: "View Message",
              style: 5,
              url: message.url,
            },
          ],
        },
      ],
    });
  } catch (error) {
    return new CommandError(`Failed to edit message: ${error}`, interaction, client).send();
  }
}
