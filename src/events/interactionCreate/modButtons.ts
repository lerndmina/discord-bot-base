import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import log from "../../utils/log";
import { redisClient } from "../../Bot";

export default async (interaction: ButtonInteraction, client: Client<true>) => {
  if (!interaction.isButton()) return false;

  // Handle moderation buttons
  if (interaction.customId.startsWith("mod_")) {
    // Require manage messages permission
    if (!interaction.memberPermissions?.has("ManageMessages")) {
      await interaction.reply({
        content: "You need the Manage Messages permission to use these moderation actions.",
        ephemeral: true,
      });
      return true;
    }

    const [action, ...args] = interaction.customId.split(":");

    switch (action) {
      case "mod_accept": {
        // Show confirmation buttons
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_accept_confirm:${args.join(":")}`)
            .setLabel("Yes, Accept Report")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: "Are you sure you want to accept this report?",
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }

      case "mod_accept_confirm": {
        const [messageId, channelId, userId] = args;

        // Update the embed to show the report was accepted
        const originalEmbed = interaction.message.embeds[0];
        const acceptedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle("✅ Report accepted")
          .setColor("#43B581"); // Discord green color

        // Add who accepted the report
        acceptedEmbed.setFooter({
          text: `${interaction.user.tag} accepted this report • ${new Date().toLocaleString()}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

        // Get the original message to update its components
        const originalMessage = await interaction.channel?.messages.fetch(
          interaction.message.reference?.messageId || ""
        );

        if (originalMessage) {
          // Update the message with no components (buttons)
          await originalMessage.edit({
            embeds: [acceptedEmbed],
            components: [],
          });
        }

        await interaction.update({
          content: "Report marked as accepted. Taking action against the message.",
          components: [],
        });

        // Optional: Take additional actions like deleting the message
        try {
          const channel = (await client.channels.fetch(channelId)) as TextChannel;
          const message = await channel.messages.fetch(messageId);
          await message.delete();

          // Log the action
          log.info(
            `Mod ${interaction.user.tag} accepted report and deleted message ${messageId} from channel ${channelId}`
          );
        } catch (error) {
          log.error("Error handling accepted report:", error);
        }
        return true;
      }

      case "mod_ignore": {
        // Show confirmation buttons
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_ignore_confirm:${args.join(":")}`)
            .setLabel("Yes, Ignore Report")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: "Are you sure you want to ignore this report?",
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }

      case "mod_ignore_confirm": {
        // Update the embed to show the report was ignored
        const originalEmbed = interaction.message.embeds[0];
        const ignoredEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle("❌ Report ignored")
          .setColor("#F04747"); // Discord red color

        // Add who ignored the report
        ignoredEmbed.setFooter({
          text: `${interaction.user.tag} ignored this report • ${new Date().toLocaleString()}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

        // Get the original message to update its components
        const originalMessage = await interaction.channel?.messages.fetch(
          interaction.message.reference?.messageId || ""
        );

        if (originalMessage) {
          // Update the message with no components (buttons)
          await originalMessage.edit({
            embeds: [ignoredEmbed],
            components: [],
          });
        }

        await interaction.update({
          content: "Report marked as ignored. No action taken.",
          components: [],
        });
        return true;
      }

      case "mod_delete": {
        const [messageId, channelId] = args;

        // Show confirmation buttons
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_delete_confirm:${args.join(":")}`)
            .setLabel("Yes, Delete Message")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("No")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: "Are you sure you want to delete this message?",
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }

      case "mod_delete_confirm": {
        const [messageId, channelId] = args;
        try {
          const channel = (await client.channels.fetch(channelId)) as TextChannel;
          const message = await channel.messages.fetch(messageId);
          await message.delete();

          await interaction.update({
            content: "Message deleted successfully.",
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `Message deleted by ${interaction.user}`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }
        } catch (error) {
          await interaction.update({
            content: "Could not delete the message. It may have been deleted already.",
            components: [],
          });
        }
        return true;
      }

      case "mod_warn": {
        const userId = args[0];

        // Show confirmation buttons with 3 options
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_warn_confirm:${args.join(":")}`)
            .setLabel("Yes, Send Default Warning")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`mod_warn_custom:${args.join(":")}`)
            .setLabel("Yes, Custom Message")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("mod_cancel")
            .setLabel("No")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: "Are you sure you want to warn this user?",
          components: [confirmRow],
          ephemeral: true,
        });
        return true;
      }

      case "mod_warn_custom": {
        const userId = args[0];

        // Create and show a modal for custom warning message
        const modal = new ModalBuilder()
          .setCustomId(`mod_warn_modal:${args.join(":")}`)
          .setTitle("Send Custom Warning Message");

        const warningInput = new TextInputBuilder()
          .setCustomId("warningMessage")
          .setLabel("Warning Message")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Enter the custom warning message to send to the user")
          .setMaxLength(1000)
          .setRequired(true);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(warningInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
        return true;
      }

      case "mod_warn_confirm": {
        const userId = args[0];
        try {
          const user = await client.users.fetch(userId);

          // Create a styled embed for the warning
          const warningEmbed = new EmbedBuilder()
            .setColor("#FF9900") // Warning orange color
            .setTitle("⚠️ Warning Notice")
            .setDescription(
              "Your recent message was flagged for violating our content policy. Please review our server rules."
            )
            .addFields(
              {
                name: "From Server",
                value: interaction.guild?.name || "Discord Server",
                inline: true,
              },
              {
                name: "Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Date",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setFooter({
              text: "If you believe this warning was issued in error, please reply here and I'll open a modmail ticket for you.",
              iconURL: interaction.guild?.iconURL() || undefined,
            })
            .setTimestamp();

          // Send the embed warning
          await user.send({ embeds: [warningEmbed] });

          await interaction.update({
            content: "Warning sent to user.",
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User warned by ${interaction.user}`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }
        } catch {
          await interaction.update({
            content: "Could not send warning to user. They may have DMs disabled.",
            components: [],
          });
        }
        return true;
      }

      case "mod_send_custom_warn": {
        const userId = args[0];
        const storageKey = args[1];

        try {
          // Retrieve warning message from Redis
          const warningMessage = await redisClient.get(storageKey);

          if (!warningMessage) {
            await interaction.update({
              content: "Warning message expired or not found. Please try again.",
              components: [],
            });
            return true;
          }

          // Delete the key from Redis as we no longer need it
          await redisClient.del(storageKey);

          // Create a styled embed for the custom warning
          const warningEmbed = new EmbedBuilder()
            .setColor("#FF9900") // Warning orange color
            .setTitle("⚠️ Warning Notice")
            .setDescription(warningMessage)
            .addFields(
              {
                name: "From Server",
                value: interaction.guild?.name || "Discord Server",
                inline: true,
              },
              {
                name: "Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Date",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setFooter({
              text: "If you believe this warning was issued in error, please contact a server administrator.",
              iconURL: interaction.guild?.iconURL() || undefined,
            })
            .setTimestamp();

          // Send the custom warning as an embed
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [warningEmbed] });

          await interaction.update({
            content: "Custom warning sent to user.",
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User warned by ${interaction.user} with custom message`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }
        } catch (error) {
          log.error("Error sending custom warning:", error);
          await interaction.update({
            content: "Could not send warning to user. They may have DMs disabled.",
            components: [],
          });
        }
        return true;
      }

      case "mod_scw": {
        // Send Custom Warning (shortened)
        const shortKey = args[0];

        try {
          // Retrieve warning data from Redis
          const storageDataJson = await redisClient.get(`mod:${shortKey}`);

          if (!storageDataJson) {
            await interaction.update({
              content: "Warning message expired or not found. Please try again.",
              components: [],
            });
            return true;
          }

          // Parse the JSON data
          const storageData = JSON.parse(storageDataJson);

          if (storageData.type !== "warning") {
            await interaction.update({
              content: "Invalid warning data. Please try again.",
              components: [],
            });
            return true;
          }

          const userId = storageData.userId;
          const warningMessage = storageData.message;

          // Delete the key from Redis as we no longer need it
          await redisClient.del(`mod:${shortKey}`);

          // Create a styled embed for the custom warning
          const warningEmbed = new EmbedBuilder()
            .setColor("#FF9900") // Warning orange color
            .setTitle("⚠️ Warning Notice")
            .setDescription(warningMessage)
            .addFields(
              {
                name: "From Server",
                value: interaction.guild?.name || "Discord Server",
                inline: true,
              },
              {
                name: "Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Date",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setFooter({
              text: "If you believe this warning was issued in error, please contact a server administrator.",
              iconURL: interaction.guild?.iconURL() || undefined,
            })
            .setTimestamp();

          // Send the custom warning as an embed
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [warningEmbed] });

          await interaction.update({
            content: "Custom warning sent to user.",
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User warned by ${interaction.user} with custom message`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }
        } catch (error) {
          log.error("Error sending custom warning:", error);
          await interaction.update({
            content: "Could not send warning to user. They may have DMs disabled.",
            components: [],
          });
        }
        return true;
      }

      case "mod_timeout": {
        const userId = args[0];

        // Create and show a modal for timeout settings
        const modal = new ModalBuilder()
          .setCustomId(`mod_timeout_modal:${args.join(":")}`)
          .setTitle("Timeout User");

        const durationInput = new TextInputBuilder()
          .setCustomId("duration")
          .setLabel("Duration (in minutes)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Enter timeout duration (e.g. 10)")
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Enter the reason for timeout")
          .setMaxLength(1000)
          .setRequired(true);

        const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
        const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

        modal.addComponents(durationRow, reasonRow);

        await interaction.showModal(modal);
        return true;
      }

      case "mod_timeout_confirm": {
        const userId = args[0];
        const durationMinutes = parseInt(args[1]);
        const storageKey = args[2];

        try {
          // Retrieve reason from Redis
          const reason = await redisClient.get(storageKey);

          if (!reason) {
            await interaction.update({
              content: "Timeout reason expired or not found. Please try again.",
              components: [],
            });
            return true;
          }

          // Delete the key from Redis as we no longer need it
          await redisClient.del(storageKey);

          // Get the guild member
          const member = await interaction.guild?.members.fetch(userId);

          if (!member) {
            await interaction.update({
              content: "Could not find the user in this server.",
              components: [],
            });
            return true;
          }

          // Convert minutes to milliseconds
          const timeoutDuration = durationMinutes * 60 * 1000;

          // Timeout the user
          await member.timeout(timeoutDuration, reason);

          await interaction.update({
            content: `User <@${userId}> has been timed out for ${durationMinutes} minutes.`,
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User timed out for ${durationMinutes} minutes by ${interaction.user}.\nReason: ${reason}`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }

          // Try to send a DM to the user with an embed
          try {
            const timeoutEmbed = new EmbedBuilder()
              .setColor("#FF0000") // Red color
              .setTitle("⏰ Timeout Notice")
              .setDescription(
                `You have been timed out in **${interaction.guild?.name}** for ${durationMinutes} minutes`
              )
              .addFields(
                {
                  name: "Reason",
                  value: reason,
                  inline: false,
                },
                {
                  name: "Moderator",
                  value: interaction.user.tag,
                  inline: true,
                },
                {
                  name: "Duration",
                  value: `${durationMinutes} minutes`,
                  inline: true,
                },
                {
                  name: "Expires",
                  value: new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleString(),
                  inline: true,
                }
              )
              .setFooter({
                text: "If you believe this timeout was issued in error, please contact a server administrator.",
                iconURL: interaction.guild?.iconURL() || undefined,
              })
              .setTimestamp();

            await member.send({ embeds: [timeoutEmbed] });
          } catch (dmError) {
            log.error("Could not send DM to timed out user", dmError);
          }
        } catch (error) {
          log.error("Error applying timeout:", error);
          await interaction.update({
            content: "Failed to timeout the user. I may not have the required permissions.",
            components: [],
          });
        }
        return true;
      }

      case "mod_cancel": {
        await interaction.update({
          content: "Action cancelled.",
          components: [],
        });
        return true;
      }

      case "mod_details": {
        const [messageId, channelId] = args;

        try {
          const channel = (await client.channels.fetch(channelId)) as TextChannel;
          const message = await channel.messages.fetch(messageId);

          // Create a detailed view with category scores
          const detailEmbed = new EmbedBuilder()
            .setTitle("Message Details")
            .setDescription(`Detailed information about the flagged message.`)
            .setColor("#5865F2") // Discord blurple
            .addFields(
              {
                name: "Full Message Content",
                value: message.content || "No text content",
                inline: false,
              },
              {
                name: "Message Link",
                value: `[Jump to message](${message.url})`,
                inline: false,
              }
            )
            .setTimestamp();

          await interaction.reply({
            embeds: [detailEmbed],
            ephemeral: true,
          });
        } catch (error) {
          await interaction.reply({
            content: "Could not fetch message details. It may have been deleted.",
            ephemeral: true,
          });
        }
        return true;
      }

      case "mod_scw": {
        // Send Custom Warning (shortened)
        const shortKey = args[0];

        try {
          // Retrieve warning data from Redis
          const storageDataJson = await redisClient.get(`mod:${shortKey}`);

          if (!storageDataJson) {
            await interaction.update({
              content: "Warning message expired or not found. Please try again.",
              components: [],
            });
            return true;
          }

          // Parse the JSON data
          const storageData = JSON.parse(storageDataJson);

          if (storageData.type !== "warning") {
            await interaction.update({
              content: "Invalid warning data. Please try again.",
              components: [],
            });
            return true;
          }

          const userId = storageData.userId;
          const warningMessage = storageData.message;

          // Delete the key from Redis as we no longer need it
          await redisClient.del(`mod:${shortKey}`);

          // Create a styled embed for the custom warning
          const warningEmbed = new EmbedBuilder()
            .setColor("#FF9900") // Warning orange color
            .setTitle("⚠️ Warning Notice")
            .setDescription(warningMessage)
            .addFields(
              {
                name: "From Server",
                value: interaction.guild?.name || "Discord Server",
                inline: true,
              },
              {
                name: "Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Date",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setFooter({
              text: "If you believe this warning was issued in error, please contact a server administrator.",
              iconURL: interaction.guild?.iconURL() || undefined,
            })
            .setTimestamp();

          // Send the custom warning as an embed
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [warningEmbed] });

          await interaction.update({
            content: "Custom warning sent to user.",
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User warned by ${interaction.user} with custom message`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }
        } catch (error) {
          log.error("Error sending custom warning:", error);
          await interaction.update({
            content: "Could not send warning to user. They may have DMs disabled.",
            components: [],
          });
        }
        return true;
      }

      case "mod_sto": {
        // Send Timeout (shortened)
        const shortKey = args[0];

        try {
          // Retrieve timeout data from Redis
          const storageDataJson = await redisClient.get(`mod:${shortKey}`);

          if (!storageDataJson) {
            await interaction.update({
              content: "Timeout data expired or not found. Please try again.",
              components: [],
            });
            return true;
          }

          // Parse the JSON data
          const storageData = JSON.parse(storageDataJson);

          if (storageData.type !== "timeout") {
            await interaction.update({
              content: "Invalid timeout data. Please try again.",
              components: [],
            });
            return true;
          }

          const userId = storageData.userId;
          const reason = storageData.reason;
          const durationMinutes = storageData.durationMinutes;

          // Delete the key from Redis as we no longer need it
          await redisClient.del(`mod:${shortKey}`);

          // Get the guild member
          const member = await interaction.guild?.members.fetch(userId);

          if (!member) {
            await interaction.update({
              content: "Could not find the user in this server.",
              components: [],
            });
            return true;
          }

          // Convert minutes to milliseconds
          const timeoutDuration = durationMinutes * 60 * 1000;

          // Timeout the user
          await member.timeout(timeoutDuration, reason);

          await interaction.update({
            content: `User <@${userId}> has been timed out for ${durationMinutes} minutes.`,
            components: [],
          });

          // Update the embed to show action taken
          const originalMessage = await interaction.channel?.messages.fetch(
            interaction.message.reference?.messageId || ""
          );

          if (originalMessage && originalMessage.embeds[0]) {
            const originalEmbed = originalMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed);

            if (!originalEmbed.fields?.find((f) => f.name === "Action Taken")) {
              updatedEmbed.addFields({
                name: "Action Taken",
                value: `User timed out for ${durationMinutes} minutes by ${interaction.user}.\nReason: ${reason}`,
                inline: false,
              });
            }

            await originalMessage.edit({
              embeds: [updatedEmbed],
            });
          }

          // Try to send a DM to the user with an embed
          try {
            const timeoutEmbed = new EmbedBuilder()
              .setColor("#FF0000") // Red color
              .setTitle("⏰ Timeout Notice")
              .setDescription(
                `You have been timed out in **${interaction.guild?.name}** for ${durationMinutes} minutes`
              )
              .addFields(
                {
                  name: "Reason",
                  value: reason,
                  inline: false,
                },
                {
                  name: "Moderator",
                  value: interaction.user.tag,
                  inline: true,
                },
                {
                  name: "Duration",
                  value: `${durationMinutes} minutes`,
                  inline: true,
                },
                {
                  name: "Expires",
                  value: new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleString(),
                  inline: true,
                }
              )
              .setFooter({
                text: "If you believe this timeout was issued in error, please contact a server administrator.",
                iconURL: interaction.guild?.iconURL() || undefined,
              })
              .setTimestamp();

            await member.send({ embeds: [timeoutEmbed] });
          } catch (dmError) {
            log.error("Could not send DM to timed out user", dmError);
          }
        } catch (error) {
          log.error("Error applying timeout:", error);
          await interaction.update({
            content: "Failed to timeout the user. I may not have the required permissions.",
            components: [],
          });
        }
        return true;
      }
    }

    // If we get here, we handled a mod_ button but didn't have a specific case for it
    return true;
  }

  // Not a mod_ button, let other handlers process it
  return false;
};
