import { CommandData, CommandOptions, SlashCommandProps } from "commandkit";
import { Attachment, ClientUser, InteractionReplyOptions, SlashCommandBuilder } from "discord.js";
import CommandError from "../../utils/interactionErrors/CommandError";
import edit from "../../subcommands/message/edit";
import { debugMsg, fetchWithRedirectCheck, ThingGetter } from "../../utils/TinyUtils";
import send from "../../subcommands/message/send";
import deleteFunc from "../../subcommands/message/deleteFunc";
import restore from "../../subcommands/message/restore";
import DownloadFile from "../../utils/DownloadFile";
import { readFileSync } from "fs";
import DeleteFile from "../../utils/DeleteFile";
import { waitingEmoji } from "../../Bot";
import log from "../../utils/log";
import axios from "axios";
import FetchEnvs from "../../utils/FetchEnvs";
const env = FetchEnvs();

const COMMAND_SEND = "send";
const COMMAND_EDIT = "edit";
const COMMAND_DELETE = "delete";
const COMMAND_RESTORE = "restore";

/*

  TODO: edit, delete, restore

*/

export const data = new SlashCommandBuilder()
  .setName("message")
  .setDescription("Edit & View Messages")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(COMMAND_SEND)
      .setDescription("Send a message.")
      .addChannelOption((option) =>
        option.setName("channel").setDescription("Where to send the message").setRequired(true)
      )
      .addAttachmentOption((option) =>
        option
          .setName("data")
          .setDescription("Data (TXT) for the the new message (base64-json, discohook.org url).")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("short-link")
          .setDescription("A short link from discohook.org")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName(COMMAND_EDIT)
      .setDescription("Edit a message posted by the bot")
      .addStringOption((option) =>
        option.setName("url").setDescription("The url of the message to edit").setRequired(true)
      )
      .addAttachmentOption((option) =>
        option
          .setName("data")
          .setDescription("Data (TXT) for the the new message (base64-json, discohook.org url).")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("remove-components")
          .setRequired(false)
          .setDescription("Remove buttons, etc from the message?")
      )
      .addStringOption((option) =>
        option
          .setName("short-link")
          .setDescription("A short link from discohook.org")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName(COMMAND_DELETE)
      .setDescription("Delete a message")
      .addStringOption((option) =>
        option.setName("url").setDescription("The url of the message to delete.").setRequired(true)
      )
  )
  .addSubcommand((command) =>
    command
      .setName(COMMAND_RESTORE)
      .setDescription("Restore a message to discohook, alternatively use the discohook bot.")
      .addStringOption((option) =>
        option.setName("url").setDescription("The url of the message to restore.").setRequired(true)
      )
  );

export const options: CommandOptions = {
  deleted: false,
  devOnly: false,
  userPermissions: ["ManageMessages"],
  botPermissions: ["ManageMessages"],
};

export async function run({ interaction, client, handler }: SlashCommandProps) {
  const getter = new ThingGetter(client);
  if (!interaction.guild) {
    return new CommandError("Command must be run in a guild.", interaction, client).send();
  }

  await interaction.reply({ content: waitingEmoji, ephemeral: true });

  try {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === COMMAND_EDIT) return await edit({ interaction, client, handler });
    if (subcommand === COMMAND_SEND) return await send({ interaction, client, handler });
    if (subcommand === COMMAND_DELETE) return await deleteFunc({ interaction, client, handler });
    if (subcommand === COMMAND_RESTORE) return await restore({ interaction, client, handler });
  } catch (error) {
    return new CommandError(error, interaction, client).send();
  }

  return new CommandError(`Invalid subcommand`, interaction, client).send();
}

export function extractFromDiscohook(url: URL) {
  if (url.host !== "discohook.org") return null;
  const base64 = url.pathname.split("/").pop();
  if (!base64) return null;
  return Buffer.from(base64, "base64").toString("utf-8");
}

export async function messageAttachmentProcessor(
  attachment: Attachment,
  shortLinkString: string
): Promise<InteractionReplyOptions> {
  if (shortLinkString && attachment)
    throw new Error("You can't use both a short link and an attachment.");
  if (!shortLinkString && !attachment)
    throw new Error("You must provide either a short link or an attachment.");

  let contents: string = "";

  if (shortLinkString) {
    let shortLink: URL;
    try {
      shortLink = new URL(shortLinkString);
    } catch (error) {
      throw new Error("Invalid short link.");
    }
    if (shortLink.host !== "share.discohook.app") throw new Error("Invalid short link.");
    await fetchWithRedirectCheck(shortLink).then((url: string) => (contents = url));
  } else if (attachment) {
    if (!attachment.contentType?.includes("text")) throw new Error("Invalid attachment.");

    const attachmentUrl = new URL(attachment.url);
    const path = `/tmp/${attachment.name}-${Date.now()}`;

    // interaction.deferReply();
    await DownloadFile(attachmentUrl, path, "txt");

    contents = readFileSync(`${path}.txt`, "utf8");
    DeleteFile(path, "txt");
  } else throw new Error("Invalid attachment.");

  if (contents.startsWith("https://discohook.app/?data=")) {
    contents = contents.replace("https://discohook.app/?data=", "");
  } else {
    let json: any;
    try {
      json = JSON.parse(contents);
    } catch (error) {
      throw new Error(
        'Invalid file contents: "json" this is not valid json. Please check the url copied from discohook.'
      );
    }
    return { content: json.content, embeds: json.embeds } as InteractionReplyOptions;
  }

  const jsonString = Buffer.from(contents, "base64").toString("utf8");
  if (!jsonString) {
    throw new Error(
      'Invalid file contents: "base64" this is not valid base64. Please check the url copied from discohook.'
    );
  }
  try {
    JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      'Invalid file contents: "json" this is not valid json. Please check the url copied from discohook.'
    );
  }

  return JSON.parse(jsonString).messages[0].data as InteractionReplyOptions;
}

export async function createShortenedLinkInZipline(data: string) {
  const url = new URL(env.ZIPLINE_BASEURL + "/api/shorten");
  const token = env.ZIPLINE_TOKEN;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Max-Views": "10",
      Authorization: `${token}`,
    },
    body: JSON.stringify({ url: data }),
  };

  const response = await fetch(url, options);
  return (await response.json()).url;
}
