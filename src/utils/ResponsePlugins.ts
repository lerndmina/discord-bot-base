import { MessageMentions } from "discord.js";
import FetchEnvs from "./FetchEnvs";

const env = FetchEnvs();

export default async function (response: string) {
  // Remove all mentions from the response
  response = response.replace(MessageMentions.UsersPattern, "\\@REMOVED");
  response = response.replace(MessageMentions.EveryonePattern, "\\@REMOVED");
  response = response.replace(MessageMentions.RolesPattern, "\\@REMOVED");

  return response;
}
