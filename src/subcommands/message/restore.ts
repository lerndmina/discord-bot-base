import { SlashCommandProps } from "commandkit";
import { Client, Message } from "discord.js";
import { ThingGetter } from "../../utils/TinyUtils";
import { MessageProcessor } from "../../utils/MessageProcessorService";
import BasicEmbed from "../../utils/BasicEmbed";
import CommandError from "../../utils/interactionErrors/CommandError";

export default async function ({ interaction, client }: SlashCommandProps) {
  try {
    const messageUrl = interaction.options.getString("url", true);
    const url = new URL(messageUrl);

    const getter = new ThingGetter(client);
    const message = await getter.getMessageFromUrl(url);

    if (!message) {
      throw new Error("Message not found");
    }

    const embed = await getRestoreEmbed(message, client);
    await interaction.editReply({ embeds: [embed], content: "" });
  } catch (error) {
    return new CommandError(`Failed to restore message: ${error}`, interaction, client).send();
  }
}

async function getRestoreEmbed(message: Message, client: Client<true>) {
  try {
    const discohookData = {
      messages: [{ data: message }],
    };

    const base64 = Buffer.from(JSON.stringify(discohookData)).toString("base64");
    const discohookUrl = `https://discohook.app/?data=${base64}`;

    const shortUrl = await MessageProcessor.createShortLink(discohookUrl);

    return BasicEmbed(
      client,
      "Message Restored to Discohook",
      [
        `Click [here](${shortUrl}) to view the message in Discohook.`,
        "",
        "**Note:** This short link will expire after a few views.",
      ].join("\n")
    );
  } catch (error) {
    throw new Error(`Failed to create restore link: ${error}`);
  }
}
