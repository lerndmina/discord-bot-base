import {
  Client,
  Interaction,
  InteractionType,
  Message,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import FetchEnvs from "../../utils/FetchEnvs";
import Database from "../../utils/data/database";
import PollsSchema, { PollsType } from "../../models/PollsSchema";
import { debugMsg, ThingGetter } from "../../utils/TinyUtils";
import BasicEmbed from "../../utils/BasicEmbed";
import { debug } from "console";
const env = FetchEnvs();
/**
 *
 * @param {StringSelectMenuInteraction} interaction
 * @param {Client} client
 */
export default async (interaction: StringSelectMenuInteraction, client: Client<true>) => {
  if (interaction.type !== InteractionType.MessageComponent) return;
  if (!interaction.customId.startsWith("poll")) return;
  const db = new Database();
  const getter = new ThingGetter(client);

  const pollId = interaction.customId;
  const poll = (await db.findOne(PollsSchema, { pollId })) as PollsType;
  if (!poll)
    return interaction.reply({
      content:
        "Poll not found. This poll is probably old enough to have been purged from my database.",
      ephemeral: true,
    });
  if (poll.hasFinished)
    return interaction.reply({ content: "Poll has already finished.", ephemeral: true });

  const voteInt = Number.parseInt(interaction.values[0]);

  const END_OPTION = poll.options.length;

  if (
    voteInt === END_OPTION &&
    !env.OWNER_IDS.includes(interaction.user.id) &&
    interaction.user.id !== poll.creatorId
  )
    return interaction.reply({
      content: "Only the poll creator can end the poll.",
      ephemeral: true,
    });

  if (voteInt === END_OPTION) {
    endPoll(client, poll.pollId, interaction.message, db, interaction);
    return true;
  }

  if (isNaN(voteInt) || voteInt < 0 || voteInt >= poll.options.length)
    return interaction.reply({ content: "Invalid vote.", ephemeral: true });

  if (poll.voters && poll.voters.includes(interaction.user.id))
    return interaction.reply({ content: "You have already voted.", ephemeral: true });

  if (!poll.voters) poll.voters = [];
  poll.voters.push(interaction.user.id);
  poll.options[voteInt].votes++;
  updateCount(poll, interaction);

  await db.findOneAndUpdate(PollsSchema, { pollId }, poll);

  interaction.reply({
    content: `You voted for \`${poll.options[voteInt].name}\``,
    ephemeral: true,
  });

  return true;
};

export function getPollEmbed(
  interaction: Interaction,
  embedDescriptionArray: string[],
  question: string
) {
  return BasicEmbed(interaction.client, question, embedDescriptionArray.join("\n"));
}

async function updateCount(poll: PollsType, interaction: StringSelectMenuInteraction) {
  if (!poll.voters || !poll.embedDescriptionArray) return;
  let totalVotes = poll.voters.length;

  poll.embedDescriptionArray[1] = `Total Votes - ${totalVotes}`;

  try {
    interaction.message.edit({
      embeds: [getPollEmbed(interaction, poll.embedDescriptionArray, poll.question)],
    });
  } catch (error) {
    // Ignore
  }
}

export async function endPoll(
  client: Client<true>,
  pollId: String,
  message: Message,
  db: Database,
  interaction?: StringSelectMenuInteraction
) {
  const poll = await db.findOne(PollsSchema, { pollId });
  if (poll.hasFinished) return;
  poll.hasFinished = true;
  await db.findOneAndUpdate(PollsSchema, { pollId }, poll);
  if (interaction) interaction.reply({ content: "Ending the poll.", ephemeral: true });

  let fields = poll.options.map((option: any) => {
    return {
      name: `Option: ${option.name}`,
      value: `${option.votes} ${option.votes === 1 ? "vote" : "votes"}`,
      inline: true,
    };
  });

  const embed = BasicEmbed(client, poll.question, "Poll has ended.", fields);

  let finalMessage: Message;

  try {
    finalMessage = await message.channel.send({ embeds: [embed] });
    await message.edit({
      components: [],
      embeds: [],
      content: `This poll has ended.\nLink to poll: ${finalMessage.url}`,
    });
  } catch (error) {
    debugMsg("Error sending poll results or editing poll message.");
  }
}
