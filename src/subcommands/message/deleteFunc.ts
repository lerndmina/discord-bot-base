import { SlashCommandProps } from "commandkit";
import { ThingGetter } from "../../utils/TinyUtils";

export default async function ({ interaction, client, handler }: SlashCommandProps) {
  const url = new URL(interaction.options.getString("url", true));
  const getter = new ThingGetter(client);
  const message = await getter.getMessageFromUrl(url);
  if (!message) {
    throw new Error("Message not found.");
  }
  await message.delete();
  return interaction.editReply("Message deleted.");
}
