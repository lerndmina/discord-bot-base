import { SlashCommandProps } from "commandkit";
import { ThingGetter } from "../../utils/TinyUtils";
import BasicEmbed from "../../utils/BasicEmbed";
import { createShortenedLinkInZipline } from "../../commands/utilities/message";
import { Client, Message } from "discord.js";

export default async function ({ interaction, client, handler }: SlashCommandProps) {
  const url = new URL(interaction.options.getString("url", true));
  const getter = new ThingGetter(client);
  const message = await getter.getMessageFromUrl(url);
  if (!message) {
    throw new Error("Message not found.");
  }
  const embed = await getRestoreEmbed(message, client);
  return interaction.editReply({ embeds: [embed], content: "" });
}

export async function getRestoreEmbed(message: Message, client: Client<true>) {
  const discoHookObject = {
    messages: [{ data: message }],
  };
  const base64 = Buffer.from(JSON.stringify(discoHookObject)).toString("base64");

  const discoHookUrl = `https://discohook.app/?data=${base64}`;

  const shortUrl = await createShortenedLinkInZipline(discoHookUrl);

  const embed = BasicEmbed(
    client,
    "Message restored to Discohook",
    `Click [here](${shortUrl}) to view the message in Discohook.\n\n**Note:** This link won't last forever.`
  );
  return embed;
}
