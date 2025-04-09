import { Attachment, InteractionReplyOptions } from "discord.js";
import { MessageProcessorResult, DiscohookData } from "../types/MessageTypes";
import { fetchWithRedirectCheck } from "../utils/TinyUtils";
import DownloadFile from "../utils/DownloadFile";
import DeleteFile from "../utils/DeleteFile";
import { readFileSync } from "fs";
import FetchEnvs from "../utils/FetchEnvs";
import log from "../utils/log";

interface ContentResult {
  success: boolean;
  error?: string;
  data?: string;
}

export class MessageProcessor {
  private static readonly VALID_HOSTS = ["discohook.org", "share.discohook.app", "shrt.zip"];
  private static readonly env = FetchEnvs();

  public static async processMessage(
    attachment?: Attachment | null,
    shortLink?: string | null
  ): Promise<MessageProcessorResult> {
    try {
      if (shortLink && attachment) {
        return { success: false, error: "Cannot use both shortlink and attachment" };
      }

      if (!shortLink && !attachment) {
        return { success: false, error: "Must provide either shortlink or attachment" };
      }

      const contents = await this.getContents(attachment, shortLink);
      if (!contents.success || !contents.data) {
        return { success: false, error: contents.error || "Failed to get contents" };
      }

      const messageData = await this.parseContents(contents.data);
      if (!messageData.success || !messageData.data) {
        return { success: false, error: messageData.error || "Failed to parse contents" };
      }

      return {
        success: true,
        data: messageData.data as InteractionReplyOptions,
      };
    } catch (error) {
      log.error(`Message processing error: ${error}`);
      return { success: false, error: `Failed to process message: ${error}` };
    }
  }

  public static async createShortLink(data: string): Promise<string> {
    const url = new URL(`${this.env.ZIPLINE_BASEURL}/api/shorten`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Max-Views": "10",
        Authorization: this.env.ZIPLINE_TOKEN,
      },
      body: JSON.stringify({ url: data }),
    });

    const result = await response.json();
    if (!result.url) {
      throw new Error("Failed to create short link");
    }

    return result.url;
  }

  private static async getContents(
    attachment?: Attachment | null,
    shortLink?: string | null
  ): Promise<ContentResult> {
    try {
      if (shortLink) {
        return await this.processShortLink(shortLink);
      }

      if (attachment) {
        return await this.processAttachment(attachment);
      }

      return { success: false, error: "No valid input provided" };
    } catch (error) {
      return { success: false, error: `Content processing error: ${error}` };
    }
  }

  private static async processShortLink(shortLink: string): Promise<ContentResult> {
    try {
      const url = new URL(shortLink);
      if (!this.VALID_HOSTS.includes(url.hostname)) {
        return { success: false, error: "Invalid short link domain" };
      }

      const redirectUrl = await fetchWithRedirectCheck(url);
      return { success: true, data: redirectUrl };
    } catch (error) {
      return { success: false, error: `Invalid short link: ${error}` };
    }
  }

  private static async processAttachment(attachment: Attachment): Promise<ContentResult> {
    if (!attachment.contentType?.includes("text")) {
      return { success: false, error: "Attachment must be text file" };
    }

    try {
      const path = `/tmp/${attachment.name}-${Date.now()}`;
      await DownloadFile(new URL(attachment.url), path, "txt");

      const contents = readFileSync(`${path}.txt`, "utf8");
      DeleteFile(path, "txt");

      return { success: true, data: contents };
    } catch (error) {
      return { success: false, error: `Failed to process attachment: ${error}` };
    }
  }

  private static async parseContents(contents: string): Promise<MessageProcessorResult> {
    try {
      if (contents.startsWith("https://discohook.org/?data=")) {
        contents = contents.replace("https://discohook.org/?data=", "");
        const jsonString = Buffer.from(contents, "base64").toString("utf8");
        const data = JSON.parse(jsonString) as DiscohookData;
        return {
          success: true,
          data: data.messages[0].data as InteractionReplyOptions,
        };
      }

      const data = JSON.parse(contents);
      return {
        success: true,
        data: {
          content: data.content,
          embeds: data.embeds,
        } as InteractionReplyOptions,
      };
    } catch (error) {
      return {
        success: false,
        error: "Invalid message data format",
      };
    }
  }
}
