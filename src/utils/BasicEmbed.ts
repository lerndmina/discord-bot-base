import { Client, EmbedBuilder, Embed, ColorResolvable, EmbedField } from "discord.js";
import { BOT_MESSAGES } from "../Bot";

export default function (
  client: Client<true>,
  title: string,
  description?: string,
  fields?: EmbedField[],
  color?: ColorResolvable
) {
  if (color == undefined) color = "#de3b79";

  var embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.avatarURL() || undefined,
    })
    .setTimestamp(Date.now())
    .setFooter({ text: BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)] });

  if (fields != undefined) {
    fields.forEach((field) => {
      embed.addFields(field);
    });
  }

  if (description && description !== "*") embed.setDescription(description);

  return embed;
}
