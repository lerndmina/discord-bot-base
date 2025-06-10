import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  CommandInteraction,
  ForumChannel,
  ThreadChannel,
  User,
  GuildMember,
} from "discord.js";
import ChecklistConfig, { ChecklistConfigType } from "../models/ChecklistConfig";
import ChecklistInstance, { ChecklistInstanceType } from "../models/ChecklistInstance";
import Checklist, { ChecklistType } from "../models/Checklist";
import ChecklistGuildConfig from "../models/ChecklistGuildConfig";
import log from "../utils/log";

interface ChecklistBuilder {
  guildId: string;
  name: string;
  description: string;
  forumChannelId: string;
  items: Array<{
    name: string;
    description: string;
    totalSteps: number;
  }>;
  callbackFunction: string;
  createdBy: string;
}

type CallbackFunction = (checklistInstance: ChecklistInstanceType, user: User) => Promise<void>;

export class ChecklistService {
  private static callbacks: Map<string, CallbackFunction> = new Map();
  private static builders: Map<string, ChecklistBuilder> = new Map();
  /**
   * Parse interaction customId to extract action and builderId
   */
  private static parseCustomId(customId: string): { action: string; builderId: string } {
    const firstUnderscoreIndex = customId.indexOf("_");
    const action = customId.substring(0, firstUnderscoreIndex);
    const builderId = customId.substring(firstUnderscoreIndex + 1);
    return { action, builderId };
  }
  /**
   * Parse modal customId to extract modalType, builderId, and optional itemIndex
   */
  private static parseModalCustomId(customId: string): {
    modalType: string;
    builderId: string;
    itemIndex?: string;
  } {
    const parts = customId.split("_");
    const modalType = parts[0];

    if (modalType === "verification-modal" || modalType === "step-verification-modal") {
      // verification-modal_checklistId_itemIndex or step-verification-modal_checklistId_itemIndex
      return {
        modalType,
        builderId: parts[1], // This is actually checklistId for verification modals
        itemIndex: parts[2],
      };
    } else {
      // title-modal_builderId, description-modal_builderId, etc.
      const firstUnderscoreIndex = customId.indexOf("_");
      const builderId = customId.substring(firstUnderscoreIndex + 1);
      return { modalType, builderId };
    }
  }

  /**
   * Register a callback function that will be executed when a checklist is completed
   */
  static registerCallback(name: string, callback: CallbackFunction): void {
    this.callbacks.set(name, callback);
  }
  /**
   * Start the interactive checklist creation process
   */
  static async startChecklistCreation(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) return;

    // Check if user has permission (admin or staff role)
    const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild.id });
    const member = interaction.member as GuildMember;

    const isAdmin = member.permissions.has("Administrator");
    const hasStaffRole =
      guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false;
    const hasPermission = isAdmin || hasStaffRole;
    if (!hasPermission) {
      log.debug(
        `Permission denied for user ${
          interaction.user.id
        }: isAdmin=${isAdmin}, hasStaffRole=${hasStaffRole}, staffRoles=${
          guildConfig?.staffRoleIds
        }, userRoles=${member.roles.cache.map((r) => r.id)}`
      );
      await interaction.reply({
        content: "You don't have permission to create checklists.",
        ephemeral: true,
      });
      return;
    } // Initialize builder
    const builderId = `${interaction.guild.id}_${interaction.user.id}_${Date.now()}`;
    log.debug(`Creating builder with ID: ${builderId}`);

    this.builders.set(builderId, {
      guildId: interaction.guild.id,
      name: "",
      description: "",
      forumChannelId: "",
      items: [],
      callbackFunction: "",
      createdBy: interaction.user.id,
    });

    log.debug(`Builder created. Total builders: ${this.builders.size}`);
    log.debug(`Available builder IDs: ${Array.from(this.builders.keys())}`);

    const embed = this.createBuilderEmbed(builderId);
    const buttons = this.createBuilderButtons(builderId);

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });
  }
  /**
   * Handle button interactions for checklist building
   */
  static async handleBuilderInteraction(interaction: ButtonInteraction): Promise<void> {
    // Parse customId properly using utility function
    const { action, builderId } = this.parseCustomId(interaction.customId);

    log.debug(`Looking for builder with ID: ${builderId}`);
    log.debug(`Available builders: ${Array.from(this.builders.keys())}`);

    const builder = this.builders.get(builderId);

    if (!builder) {
      log.debug(
        `Builder not found for ID: ${builderId}. Available builders: ${Array.from(
          this.builders.keys()
        )}`
      );
      await interaction.reply({
        content: "Checklist builder not found. Please try creating a new checklist.",
        ephemeral: true,
      });
      return;
    }

    // Check if user has permission (creator, admin, or staff role)
    const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild?.id });
    const member = interaction.member as GuildMember;

    const hasPermission =
      builder.createdBy === interaction.user.id ||
      member.permissions.has("Administrator") ||
      (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

    if (!hasPermission) {
      await interaction.reply({
        content: "You don't have permission to modify this checklist.",
        ephemeral: true,
      });
      return;
    }

    switch (action) {
      case "set-title":
        await this.showTitleModal(interaction, builderId);
        break;
      case "set-description":
        await this.showDescriptionModal(interaction, builderId);
        break;
      case "set-forum":
        await this.showForumModal(interaction, builderId);
        break;
      case "add-item":
        await this.showItemModal(interaction, builderId);
        break;
      case "edit-item":
        await this.showItemEditSelection(interaction, builderId);
        break;
      case "save-checklist":
        await this.saveChecklist(interaction, builderId);
        break;
      case "cancel-builder":
        await this.cancelBuilder(interaction, builderId);
        break;
    }
  }

  /**
   * Create checklist instance for a user
   */
  static async createChecklistInstance(
    interaction: CommandInteraction,
    checklistName: string,
    targetUser: User
  ): Promise<void> {
    if (!interaction.guild) return;

    // Check permissions
    const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild.id });
    const member = interaction.member as GuildMember;

    const hasPermission =
      member.permissions.has("Administrator") ||
      (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

    if (!hasPermission) {
      await interaction.reply({
        content: "You don't have permission to create checklist instances.",
        ephemeral: true,
      });
      return;
    }

    // Find checklist config
    const checklistConfig = await ChecklistConfig.findOne({
      guildId: interaction.guild.id,
      name: checklistName,
    });

    if (!checklistConfig) {
      await interaction.reply({
        content: `Checklist "${checklistName}" not found.`,
        ephemeral: true,
      });
      return;
    }

    // Get forum channel
    const forumChannel = interaction.guild.channels.cache.get(
      checklistConfig.forumChannelId
    ) as ForumChannel;
    if (!forumChannel || forumChannel.type !== 15) {
      // ChannelType.GuildForum
      await interaction.reply({
        content: "Forum channel not found or invalid.",
        ephemeral: true,
      });
      return;
    }

    // Create checklist document
    const checklist = new Checklist({
      guildId: interaction.guild.id,
      items: checklistConfig.items.map((item) => ({
        name: item.name,
        description: item.description,
        completedSteps: 0,
        totalSteps: item.totalSteps,
        completedData: [],
      })),
    });

    await checklist.save(); // Create forum thread
    const display = this.createInstanceDisplay(
      checklistConfig,
      targetUser,
      checklist,
      checklist._id.toString()
    );

    const thread = await forumChannel.threads.create({
      name: `${checklistConfig.name} - ${targetUser.displayName}`,
      message: {
        embeds: display.embeds,
        components: display.components,
      },
    });

    // Get the starter message ID from the thread
    const starterMessage = await thread.fetchStarterMessage();
    const messageUrl = starterMessage
      ? `https://discord.com/channels/${interaction.guild.id}/${thread.id}/${starterMessage.id}`
      : `https://discord.com/channels/${interaction.guild.id}/${thread.id}`;

    // Create checklist instance
    const instance = new ChecklistInstance({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      messageUrl: messageUrl,
      checklist: checklist,
    });

    await instance.save();

    await interaction.reply({
      content: `Checklist instance created for ${targetUser.displayName}: ${thread.url}`,
      ephemeral: true,
    });
  }
  /**
   * Handle checklist item verification by staff
   */
  static async handleItemVerification(interaction: ButtonInteraction): Promise<void> {
    const [action, checklistId, itemIndex] = interaction.customId.split("_");

    if (action !== "verify-item") return;

    // Check permissions
    const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild?.id });
    const member = interaction.member as GuildMember;

    const hasPermission =
      member.permissions.has("Administrator") ||
      (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

    if (!hasPermission) {
      await interaction.reply({
        content: "You don't have permission to verify checklist items.",
        ephemeral: true,
      });
      return;
    }

    // Check if item is already completed
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) {
      await interaction.reply({
        content: "Checklist instance not found.",
        ephemeral: true,
      });
      return;
    }

    const item = instance.checklist.items[parseInt(itemIndex)];
    if (!item) {
      await interaction.reply({
        content: "Checklist item not found.",
        ephemeral: true,
      });
      return;
    }

    if (item.completedSteps >= item.totalSteps) {
      await interaction.reply({
        content: `✅ This item "${item.name}" is already completed (${item.completedSteps}/${item.totalSteps} steps).`,
        ephemeral: true,
      });
      return;
    }

    // Show verification modal
    await this.showVerificationModal(interaction, checklistId, parseInt(itemIndex));
  }

  /**
   * Handle staff management menu
   */
  static async handleStaffManagement(interaction: ButtonInteraction): Promise<void> {
    const checklistId = interaction.customId.replace("manage-checklist_", "");

    // Check permissions
    const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild?.id });
    const member = interaction.member as GuildMember;

    const hasPermission =
      member.permissions.has("Administrator") ||
      (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

    if (!hasPermission) {
      await interaction.reply({
        content: "You don't have permission to manage checklist items.",
        ephemeral: true,
      });
      return;
    }

    // Find the checklist instance
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) {
      await interaction.reply({
        content: "Checklist instance not found.",
        ephemeral: true,
      });
      return;
    }

    // Find config by matching items
    const configs = await ChecklistConfig.find({ guildId: instance.guildId });
    const config = configs.find((c) => c.items.length === instance.checklist.items.length);

    if (!config) {
      await interaction.reply({
        content: "Checklist configuration not found.",
        ephemeral: true,
      });
      return;
    } // Create management embed with verification buttons
    const embed = new EmbedBuilder()
      .setTitle("📋 Staff Management")
      .setDescription(
        "Click buttons to verify checklist items. Red = Incomplete, Green = Complete (disabled)"
      )
      .setColor(0x5865f2);

    // Show all items with their progress
    instance.checklist.items.forEach((item, index) => {
      const progress = `${item.completedSteps}/${item.totalSteps}`;
      const status = item.completedSteps >= item.totalSteps ? "✅ Complete" : "⏳ Incomplete";
      embed.addFields({
        name: `${status} ${item.name} (${progress} steps)`,
        value: item.description,
        inline: false,
      });
    });

    if (instance.checklist.items.every((item) => item.completedSteps >= item.totalSteps)) {
      embed.setDescription("✅ All items are completed!");
      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      return;
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    // Create verification buttons for all items (max 5 per row)
    for (let i = 0; i < instance.checklist.items.length; i += 5) {
      const rowItems = instance.checklist.items.slice(i, i + 5);
      const verificationRow = new ActionRowBuilder<ButtonBuilder>();
      rowItems.forEach((item, relativeIndex) => {
        const actualIndex = i + relativeIndex;
        const isComplete = item.completedSteps >= item.totalSteps;
        const buttonLabel = `${item.name.substring(0, 15)}${item.name.length > 15 ? "..." : ""}`;

        verificationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`verify-item_${checklistId}_${actualIndex}`)
            .setLabel(buttonLabel)
            .setStyle(isComplete ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(isComplete) // Disable completed items
        );
      });

      components.push(verificationRow);
    }

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }
  /**
   * Complete item verification (for single-step items or final verification)
   */
  static async completeItemVerification(
    checklistId: string,
    itemIndex: number,
    staffUserId: string,
    comment: string,
    stepsToComplete?: number,
    interaction?: any
  ): Promise<void> {
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) return;

    const item = instance.checklist.items[itemIndex];
    if (!item) return;

    const completionsToAdd = stepsToComplete || item.totalSteps - item.completedSteps;

    // Store original completed steps for completion message
    const originalCompletedSteps = item.completedSteps;

    // Add completion data for each step
    for (let i = 0; i < completionsToAdd; i++) {
      item.completedData.push({
        userId: staffUserId,
        completionComment: comment,
        completedAt: new Date(),
      });
    }

    // Update completed steps
    item.completedSteps = Math.min(item.completedSteps + completionsToAdd, item.totalSteps);

    await instance.save();

    // Post step completion message(s) if interaction is provided
    if (interaction) {
      const configs = await ChecklistConfig.find({ guildId: instance.guildId });
      const config = configs.find((c) => c.items.length === instance.checklist.items.length);

      if (config) {
        const user = await interaction.client.users.fetch(instance.userId);
        await this.postStepCompletionMessage(
          interaction,
          checklistId,
          itemIndex,
          staffUserId,
          comment,
          completionsToAdd,
          item,
          config,
          user
        );
      }
    }

    // Check if all items are completed
    const allCompleted = instance.checklist.items.every(
      (item) => item.completedSteps >= item.totalSteps
    );

    if (allCompleted && interaction) {
      // Send completion message in the thread
      const configs = await ChecklistConfig.find({ guildId: instance.guildId });
      const config = configs.find((c) => c.items.length === instance.checklist.items.length);

      if (config) {
        const completionEmbed = new EmbedBuilder()
          .setTitle("🎉 Checklist Completed!")
          .setDescription(
            `<@${instance.userId}>, congratulations! You have completed the **${config.name}** checklist.`
          )
          .setColor(0x00ff00)
          .addFields({
            name: "Next Steps",
            value:
              "Your completion has been recorded. Please wait for any additional instructions from staff.",
            inline: false,
          })
          .setTimestamp();

        // Use followUp instead of sending directly to avoid interaction conflicts
        setTimeout(async () => {
          try {
            await interaction.followUp({
              embeds: [completionEmbed],
              content: `<@${instance.userId}>`,
            });
          } catch (error) {
            log.error(`Error sending completion message: ${error}`);
          }
        }, 1000);

        await this.executeCallback(instance);
      }
    }
  }

  /**
   * Execute callback when checklist is completed
   */
  private static async executeCallback(instance: ChecklistInstanceType): Promise<void> {
    const config = await ChecklistConfig.findOne({
      guildId: instance.guildId,
      items: { $size: instance.checklist.items.length },
    });

    if (config?.callbackFunction) {
      const callback = this.callbacks.get(config.callbackFunction);
      if (callback) {
        try {
          // We need the user object, but we have userId
          // This would need to be handled by the calling context
          // For now, we'll skip the actual callback execution
          console.log(
            `Checklist completed for user ${instance.userId}, callback: ${config.callbackFunction}`
          );
        } catch (error) {
          console.error("Error executing checklist callback:", error);
        }
      }
    }
  }
  /**
   * Create complete checklist instance display with embed and buttons
   */
  private static createInstanceDisplay(
    config: ChecklistConfigType,
    user: User,
    checklist: ChecklistType,
    checklistId: string
  ): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const embed = this.createInstanceEmbed(config, user, checklist);
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    // Staff Management Menu - only show if there are incomplete items
    const incompleteItems = checklist.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.completedSteps < item.totalSteps);

    if (incompleteItems.length > 0) {
      const managementRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`manage-checklist_${checklistId}`)
          .setLabel("🛠️ Staff Management")
          .setStyle(ButtonStyle.Primary)
      );
      components.push(managementRow);
    }

    return { embeds: [embed], components };
  }

  // Helper methods for creating embeds and buttons
  private static createBuilderEmbed(builderId: string): EmbedBuilder {
    const builder = this.builders.get(builderId);
    if (!builder) throw new Error("Builder not found");

    const embed = new EmbedBuilder()
      .setTitle("Checklist Builder")
      .setColor(0x00ae86)
      .addFields(
        { name: "Name", value: builder.name || "*Not set*", inline: true },
        { name: "Description", value: builder.description || "*Not set*", inline: true },
        {
          name: "Forum Channel",
          value: builder.forumChannelId ? `<#${builder.forumChannelId}>` : "*Not set*",
          inline: true,
        },
        {
          name: "Items",
          value:
            builder.items.length > 0
              ? builder.items
                  .map(
                    (item, i) =>
                      `${i + 1}. **${item.name}** - ${item.description} - ${
                        item.totalSteps
                      } step(s)`
                  )
                  .join("\n")
              : "*No items added*",
        }
      );

    return embed;
  }

  private static createBuilderButtons(builderId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`set-title_${builderId}`)
        .setLabel("Set Title")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set-description_${builderId}`)
        .setLabel("Set Description")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`set-forum_${builderId}`)
        .setLabel("Set Forum")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`add-item_${builderId}`)
        .setLabel("Add Item")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`save-checklist_${builderId}`)
        .setLabel("Save")
        .setStyle(ButtonStyle.Success)
    );
  }
  private static createInstanceEmbed(
    config: ChecklistConfigType,
    user: User,
    checklist: ChecklistType
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${config.name} - ${user.displayName}`)
      .setDescription(config.description)
      .setColor(0x00ae86)
      .setThumbnail(user.displayAvatarURL());

    checklist.items.forEach((item, index) => {
      const progress = `(${item.completedSteps}/${item.totalSteps})`;
      const status = item.completedSteps >= item.totalSteps ? "✅" : "⏳";

      embed.addFields({
        name: `${status} ${item.name} ${progress}`,
        value: item.description,
        inline: false,
      });
    });

    embed.addFields({
      name: "Instructions",
      value:
        "Please provide evidence for each checklist item in this thread. Staff will verify your submissions.",
      inline: false,
    });
    return embed;
  }

  // Modal creation methods
  private static async showTitleModal(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`title-modal_${builderId}`)
      .setTitle("Set Checklist Title");

    const titleInput = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Checklist Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }

  private static async showDescriptionModal(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`description-modal_${builderId}`)
      .setTitle("Set Checklist Description");

    const descriptionInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Checklist Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
  private static async showForumModal(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`forum-modal_${builderId}`)
      .setTitle("Set Forum Channel");

    const forumInput = new TextInputBuilder()
      .setCustomId("forum")
      .setLabel("Forum Channel ID")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Right-click a forum channel → Copy Channel ID")
      .setMaxLength(20);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(forumInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }

  private static async showItemModal(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`item-modal_${builderId}`)
      .setTitle("Add Checklist Item");

    const nameInput = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Item Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Item Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const stepsInput = new TextInputBuilder()
      .setCustomId("steps")
      .setLabel("Total Steps")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue("1")
      .setPlaceholder("Number of steps required (default: 1)");

    const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const actionRow3 = new ActionRowBuilder<TextInputBuilder>().addComponents(stepsInput);

    modal.addComponents(actionRow1, actionRow2, actionRow3);

    await interaction.showModal(modal);
  }
  private static async showVerificationModal(
    interaction: ButtonInteraction,
    checklistId: string,
    itemIndex: number
  ): Promise<void> {
    // Find the checklist instance to get step information
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) {
      await interaction.reply({
        content: "Checklist instance not found.",
        ephemeral: true,
      });
      return;
    }

    const item = instance.checklist.items[itemIndex];
    if (!item) {
      await interaction.reply({
        content: "Checklist item not found.",
        ephemeral: true,
      });
      return;
    }

    // If item has multiple steps and isn't complete, show step selection
    if (item.totalSteps > 1 && item.completedSteps < item.totalSteps) {
      await this.showStepSelectionModal(interaction, checklistId, itemIndex, item);
    } else {
      // Single step item or completing final step
      const modal = new ModalBuilder()
        .setCustomId(`verification-modal_${checklistId}_${itemIndex}`)
        .setTitle(`Verify: ${item.name}`);

      const commentInput = new TextInputBuilder()
        .setCustomId("comment")
        .setLabel("Verification Comment")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("Describe how the user fulfilled this requirement...");

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    }
  }
  private static async showStepSelectionModal(
    interaction: ButtonInteraction,
    checklistId: string,
    itemIndex: number,
    item: any
  ): Promise<void> {
    const remainingSteps = item.totalSteps - item.completedSteps;
    const nextStepNumber = item.completedSteps + 1;
    const lastStepNumber = item.totalSteps;

    // Create step range examples based on remaining steps
    let exampleText = "";
    if (remainingSteps === 1) {
      exampleText = `${nextStepNumber}`;
    } else if (remainingSteps === 2) {
      exampleText = `${nextStepNumber}, ${nextStepNumber}-${lastStepNumber}, or ALL`;
    } else {
      exampleText = `${nextStepNumber}, ${nextStepNumber}-${lastStepNumber}, ${nextStepNumber},${
        nextStepNumber + 1
      }, or ALL`;
    }

    const modal = new ModalBuilder()
      .setCustomId(`step-verification-modal_${checklistId}_${itemIndex}`)
      .setTitle(`Verify Steps: ${item.name}`);

    const stepsInput = new TextInputBuilder()
      .setCustomId("steps")
      .setLabel(`Steps to mark complete (${nextStepNumber}-${lastStepNumber})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(`Completed: ${item.completedSteps}/${item.totalSteps}. Enter: ${exampleText}`)
      .setMaxLength(50);

    const commentInput = new TextInputBuilder()
      .setCustomId("comment")
      .setLabel("Verification Comment")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder("Describe what steps were completed and evidence provided...");

    const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(stepsInput);
    const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput);

    modal.addComponents(actionRow1, actionRow2);

    await interaction.showModal(modal);
  }
  /**
   * Handle modal submissions
   */
  static async handleModalSubmit(interaction: any): Promise<void> {
    const { modalType, builderId, itemIndex } = this.parseModalCustomId(interaction.customId);

    log.debug(
      `Modal submission - Type: ${modalType}, BuilderId: ${builderId}, ItemIndex: ${itemIndex}`
    );
    log.debug(`Available builders: ${Array.from(this.builders.keys())}`);

    // For checklist builder modals, check permissions
    if (["title-modal", "description-modal", "forum-modal", "item-modal"].includes(modalType)) {
      const builder = this.builders.get(builderId);
      if (!builder) {
        log.debug(`Builder not found for modal submission. BuilderId: ${builderId}`);
        await interaction.reply({
          content: "Checklist builder not found. Please try creating a new checklist.",
          ephemeral: true,
        });
        return;
      }

      // Check if user has permission (creator, admin, or staff role)
      const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild?.id });
      const member = interaction.member as GuildMember;

      const hasPermission =
        builder.createdBy === interaction.user.id ||
        member.permissions.has("Administrator") ||
        (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

      if (!hasPermission) {
        await interaction.reply({
          content: "You don't have permission to modify this checklist.",
          ephemeral: true,
        });
        return;
      }
    } // For verification modals, check staff permissions
    if (modalType === "verification-modal" || modalType === "step-verification-modal") {
      const guildConfig = await ChecklistGuildConfig.findOne({ guildId: interaction.guild?.id });
      const member = interaction.member as GuildMember;

      const hasPermission =
        member.permissions.has("Administrator") ||
        (guildConfig?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false);

      if (!hasPermission) {
        await interaction.reply({
          content: "You don't have permission to verify checklist items.",
          ephemeral: true,
        });
        return;
      }
    }
    switch (modalType) {
      case "title-modal":
        await this.handleTitleSubmit(interaction, builderId);
        break;
      case "description-modal":
        await this.handleDescriptionSubmit(interaction, builderId);
        break;
      case "forum-modal":
        await this.handleForumSubmit(interaction, builderId);
        break;
      case "item-modal":
        await this.handleItemSubmit(interaction, builderId);
        break;
      case "verification-modal":
        if (itemIndex !== undefined) {
          await this.handleVerificationSubmit(interaction, builderId, parseInt(itemIndex));
        }
        break;
      case "step-verification-modal":
        if (itemIndex !== undefined) {
          await this.handleStepVerificationSubmit(interaction, builderId, parseInt(itemIndex));
        }
        break;
    }
  }

  private static async handleTitleSubmit(interaction: any, builderId: string): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder) return;

    builder.name = interaction.fields.getTextInputValue("title");
    this.builders.set(builderId, builder);

    const embed = this.createBuilderEmbed(builderId);
    const buttons = this.createBuilderButtons(builderId);

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  }

  private static async handleDescriptionSubmit(interaction: any, builderId: string): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder) return;

    builder.description = interaction.fields.getTextInputValue("description");
    this.builders.set(builderId, builder);

    const embed = this.createBuilderEmbed(builderId);
    const buttons = this.createBuilderButtons(builderId);

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  }
  private static async handleForumSubmit(interaction: any, builderId: string): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder) return;

    const forumChannelId = interaction.fields.getTextInputValue("forum");

    // Validate that the channel exists and is a forum channel
    const channel = interaction.guild?.channels.cache.get(forumChannelId);
    if (!channel) {
      await interaction.reply({
        content: "❌ Channel not found. Please provide a valid channel ID.",
        ephemeral: true,
      });
      return;
    }

    if (channel.type !== 15) {
      // ChannelType.GuildForum = 15
      await interaction.reply({
        content: "❌ The provided channel is not a forum channel. Please select a forum channel.",
        ephemeral: true,
      });
      return;
    }

    // Check if bot has permissions to create threads in the forum
    const botMember = interaction.guild?.members.me;
    if (botMember) {
      const permissions = channel.permissionsFor(botMember);
      if (!permissions?.has(["ViewChannel", "SendMessages", "CreatePublicThreads"])) {
        await interaction.reply({
          content:
            "⚠️ I don't have the required permissions in that forum channel. Please ensure I can view the channel, send messages, and create threads.",
          ephemeral: true,
        });
        return;
      }
    }

    builder.forumChannelId = forumChannelId;
    this.builders.set(builderId, builder);

    const embed = this.createBuilderEmbed(builderId);
    const buttons = this.createBuilderButtons(builderId);

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  }

  private static async handleItemSubmit(interaction: any, builderId: string): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder) return;

    const name = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const stepsValue = interaction.fields.getTextInputValue("steps") || "1";
    const totalSteps = parseInt(stepsValue) || 1;

    builder.items.push({
      name,
      description,
      totalSteps,
    });

    this.builders.set(builderId, builder);

    const embed = this.createBuilderEmbed(builderId);
    const buttons = this.createBuilderButtons(builderId);

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  }
  private static async handleVerificationSubmit(
    interaction: any,
    checklistId: string,
    itemIndex: number
  ): Promise<void> {
    const comment = interaction.fields.getTextInputValue("comment");

    // Complete the verification (simple single-step or complete remaining steps)
    await this.completeItemVerification(
      checklistId,
      itemIndex,
      interaction.user.id,
      comment,
      undefined,
      interaction
    );

    await this.refreshChecklistDisplay(interaction, checklistId, itemIndex, "verified");
  }

  private static async handleStepVerificationSubmit(
    interaction: any,
    checklistId: string,
    itemIndex: number
  ): Promise<void> {
    const stepsInput = interaction.fields.getTextInputValue("steps").trim().toLowerCase();
    const comment = interaction.fields.getTextInputValue("comment");

    // Find the instance to get current step information
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) {
      await interaction.reply({
        content: "Checklist instance not found.",
        ephemeral: true,
      });
      return;
    }

    const item = instance.checklist.items[itemIndex];
    if (!item) {
      await interaction.reply({
        content: "Checklist item not found.",
        ephemeral: true,
      });
      return;
    }
    let stepsToComplete = 0;

    try {
      const nextStepNumber = item.completedSteps + 1;
      const remainingSteps = item.totalSteps - item.completedSteps;

      if (remainingSteps === 0) {
        throw new Error("All steps already completed");
      }

      if (stepsInput === "all") {
        stepsToComplete = remainingSteps;
      } else if (stepsInput.includes("-")) {
        // Range like "2-3" (for remaining steps)
        const [start, end] = stepsInput.split("-").map((n) => parseInt(n.trim()));

        // Validate that the range is within remaining steps
        if (start < nextStepNumber || end > item.totalSteps || start > end) {
          throw new Error(`Invalid range. Available steps: ${nextStepNumber}-${item.totalSteps}`);
        }

        stepsToComplete = end - start + 1;
      } else if (stepsInput.includes(",")) {
        // Multiple steps like "2,3" (for remaining steps)
        const steps = stepsInput.split(",").map((n) => parseInt(n.trim()));

        // Validate that all specified steps are in the remaining range
        if (!steps.every((s) => s >= nextStepNumber && s <= item.totalSteps)) {
          throw new Error(
            `Invalid step numbers. Available steps: ${nextStepNumber}-${item.totalSteps}`
          );
        }

        // Remove duplicates and count unique steps
        const uniqueSteps = [...new Set(steps)];
        stepsToComplete = uniqueSteps.length;
      } else {
        // Single step
        const stepNum = parseInt(stepsInput);

        // Validate that the step number is in the remaining range
        if (stepNum < nextStepNumber || stepNum > item.totalSteps) {
          throw new Error(
            `Invalid step number. Available steps: ${nextStepNumber}-${item.totalSteps}`
          );
        }

        stepsToComplete = 1;
      }

      if (stepsToComplete <= 0 || stepsToComplete > remainingSteps) {
        throw new Error("Invalid number of steps");
      }
    } catch (error) {
      const nextStepNumber = item.completedSteps + 1;
      const availableRange =
        nextStepNumber === item.totalSteps
          ? `${nextStepNumber}`
          : `${nextStepNumber}-${item.totalSteps}`;

      const errorMessage = error instanceof Error ? error.message : "Invalid input";

      await interaction.reply({
        content: `❌ ${errorMessage}. Available steps: ${availableRange}. Use formats like: ${nextStepNumber}, ${
          nextStepNumber === item.totalSteps
            ? nextStepNumber
            : `${nextStepNumber}-${item.totalSteps}`
        }, or ALL`,
        ephemeral: true,
      });
      return;
    }

    // Complete the verification with the specified number of steps
    await this.completeItemVerification(
      checklistId,
      itemIndex,
      interaction.user.id,
      comment,
      stepsToComplete,
      interaction
    );

    await this.refreshChecklistDisplay(
      interaction,
      checklistId,
      itemIndex,
      `${stepsToComplete} step${stepsToComplete > 1 ? "s" : ""} verified`
    );
  }
  private static async refreshChecklistDisplay(
    interaction: any,
    checklistId: string,
    itemIndex: number,
    action: string
  ): Promise<void> {
    // Find the instance to get updated data
    const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
    if (!instance) {
      await interaction.reply({
        content: "Checklist instance not found.",
        ephemeral: true,
      });
      return;
    }

    // Find config by matching items
    const configs = await ChecklistConfig.find({ guildId: instance.guildId });
    const config = configs.find((c) => c.items.length === instance.checklist.items.length);

    if (!config) {
      await interaction.reply({
        content: `Item ${action} successfully, but could not refresh display.`,
        ephemeral: true,
      });
      return;
    }

    // Get user info
    const user = await interaction.client.users.fetch(instance.userId);

    // Create updated display
    const display = this.createInstanceDisplay(config, user, instance.checklist, checklistId);
    try {
      // Parse the message URL to get channel and message IDs
      // URL format: https://discord.com/channels/guildId/channelId/messageId (preferred)
      // OR: https://discord.com/channels/guildId/channelId (legacy format)
      let channelId: string;
      let messageId: string | undefined;

      const urlWithMessageMatch = instance.messageUrl.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
      if (urlWithMessageMatch) {
        // New format with message ID
        [, channelId, messageId] = urlWithMessageMatch;
      } else {
        // Legacy format without message ID - try to extract channel ID only
        const urlWithoutMessageMatch = instance.messageUrl.match(/\/channels\/\d+\/(\d+)/);
        if (urlWithoutMessageMatch) {
          [, channelId] = urlWithoutMessageMatch;
        } else {
          log.debug(`Invalid message URL format: ${instance.messageUrl}`);
          throw new Error("Invalid message URL format");
        }
      }

      // Fetch the forum thread channel
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || !channel.isThread()) {
        log.debug(`Channel ${channelId} is not a thread or could not be fetched`);
        throw new Error("Channel is not a thread");
      }

      let checklistMessage;

      if (messageId) {
        // Try to fetch the specific message
        try {
          checklistMessage = await channel.messages.fetch(messageId);
        } catch (error) {
          log.debug(`Could not find message ${messageId}, trying to find starter message`);
          checklistMessage = await channel.fetchStarterMessage();
        }
      } else {
        // Legacy format - fetch the starter message
        checklistMessage = await channel.fetchStarterMessage();
      }

      if (!checklistMessage) {
        log.debug(`Could not find checklist message in thread ${channelId}`);
        throw new Error("Message not found");
      }

      await checklistMessage.edit({
        embeds: display.embeds,
        components: display.components,
      });

      log.debug(`Successfully updated checklist message in thread ${channelId}`);
    } catch (error) {
      log.error(`Error updating checklist message: ${error}`);
      // Don't throw here, just log and continue to reply to the user
    }

    await interaction.reply({
      content: `✅ "${config.items[itemIndex]?.name}" ${action} successfully!`,
      ephemeral: true,
    });
  }

  private static async saveChecklist(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder) return;

    // Validate required fields
    if (
      !builder.name ||
      !builder.description ||
      !builder.forumChannelId ||
      builder.items.length === 0
    ) {
      await interaction.reply({
        content: "Please fill in all required fields and add at least one item.",
        ephemeral: true,
      });
      return;
    }

    // Save to database
    const checklistConfig = new ChecklistConfig(builder);
    await checklistConfig.save();

    // Clean up builder
    this.builders.delete(builderId);

    await interaction.update({
      content: `✅ Checklist "${builder.name}" saved successfully!`,
      embeds: [],
      components: [],
    });
  }

  private static async cancelBuilder(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    this.builders.delete(builderId);

    await interaction.update({
      content: "❌ Checklist creation cancelled.",
      embeds: [],
      components: [],
    });
  }

  private static async showItemEditSelection(
    interaction: ButtonInteraction,
    builderId: string
  ): Promise<void> {
    const builder = this.builders.get(builderId);
    if (!builder || builder.items.length === 0) {
      await interaction.reply({
        content: "No items to edit.",
        ephemeral: true,
      });
      return;
    }

    // For now, just show a simple message. In a full implementation,
    // you'd create a select menu to choose which item to edit
    await interaction.reply({
      content: "Item editing feature coming soon!",
      ephemeral: true,
    });
  }

  /**
   * Get all checklist names for a guild (for autocomplete)
   */
  static async getChecklistNames(guildId: string): Promise<string[]> {
    const configs = await ChecklistConfig.find({ guildId }, "name").lean();
    return configs.map((config) => config.name);
  }

  /**
   * Delete a checklist configuration
   */
  static async deleteChecklist(guildId: string, checklistName: string): Promise<boolean> {
    const result = await ChecklistConfig.deleteOne({ guildId, name: checklistName });
    return result.deletedCount > 0;
  }

  /**
   * Get checklist configuration by name
   */
  static async getChecklistConfig(
    guildId: string,
    checklistName: string
  ): Promise<ChecklistConfigType | null> {
    return await ChecklistConfig.findOne({ guildId, name: checklistName });
  }

  /**
   * List all checklist configurations for a guild
   */
  static async listChecklists(guildId: string): Promise<ChecklistConfigType[]> {
    return await ChecklistConfig.find({ guildId }).sort({ createdAt: -1 });
  }

  /**
   * Migration method to update existing checklist instances with proper message URLs
   * This should be called once to fix legacy instances
   */
  static async migrateMessageUrls(client: any): Promise<void> {
    try {
      // Find all instances with legacy URL format (no message ID)
      const instances = await ChecklistInstance.find({
        messageUrl: { $regex: /\/channels\/\d+\/\d+$/ }, // URLs ending with channel ID only
      });

      let updated = 0;
      let failed = 0;

      for (const instance of instances) {
        try {
          // Extract channel ID from legacy URL
          const urlMatch = instance.messageUrl.match(/\/channels\/(\d+)\/(\d+)$/);
          if (!urlMatch) continue;

          const [, guildId, channelId] = urlMatch;

          // Fetch the thread and starter message
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isThread()) {
            const starterMessage = await channel.fetchStarterMessage();
            if (starterMessage) {
              // Update the instance with the proper message URL
              instance.messageUrl = `https://discord.com/channels/${guildId}/${channelId}/${starterMessage.id}`;
              await instance.save();
              updated++;
              log.debug(`Updated message URL for instance ${instance._id}`);
            } else {
              failed++;
              log.debug(`Could not find starter message for thread ${channelId}`);
            }
          } else {
            failed++;
            log.debug(`Channel ${channelId} is not a thread or could not be fetched`);
          }
        } catch (error) {
          failed++;
          log.error(`Error updating instance ${instance._id}: ${error}`);
        }
      }

      log(`Migration completed: ${updated} instances updated, ${failed} failed`, "INFO");
    } catch (error) {
      log.error(`Error during message URL migration: ${error}`);
    }
  }

  /**
   * Post step completion message(s) in the forum thread
   */
  private static async postStepCompletionMessage(
    interaction: any,
    checklistId: string,
    itemIndex: number,
    staffUserId: string,
    comment: string,
    stepsCompleted: number,
    item: any,
    config: ChecklistConfigType,
    user: User
  ): Promise<void> {
    try {
      // Parse the message URL to get the thread channel
      const instance = await ChecklistInstance.findOne({ "checklist._id": checklistId });
      if (!instance) return;

      let channelId: string;
      const urlWithMessageMatch = instance.messageUrl.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
      if (urlWithMessageMatch) {
        [, channelId] = urlWithMessageMatch;
      } else {
        const urlWithoutMessageMatch = instance.messageUrl.match(/\/channels\/\d+\/(\d+)/);
        if (urlWithoutMessageMatch) {
          [, channelId] = urlWithoutMessageMatch;
        } else {
          log.debug(`Invalid message URL format: ${instance.messageUrl}`);
          return;
        }
      }

      // Fetch the forum thread channel
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || !channel.isThread()) {
        log.debug(`Channel ${channelId} is not a thread or could not be fetched`);
        return;
      }

      // Create embeds for each completed step
      const embeds: EmbedBuilder[] = [];
      const staffMember = await interaction.client.users.fetch(staffUserId);

      for (let i = 0; i < stepsCompleted; i++) {
        const stepNumber = item.completedSteps - stepsCompleted + i + 1;
        const embed = new EmbedBuilder()
          .setTitle(`✅ ${item.name} (${stepNumber}/${item.totalSteps}) Completed`)
          .setDescription(comment)
          .setColor(0x00ff00)
          .addFields(
            {
              name: "Item Description",
              value: item.description,
              inline: false,
            },
            {
              name: "Verified By",
              value: `<@${staffUserId}>`,
              inline: true,
            },
            {
              name: "Progress",
              value: `${item.completedSteps}/${item.totalSteps} steps completed`,
              inline: true,
            }
          )
          .setThumbnail(staffMember.displayAvatarURL())
          .setTimestamp()
          .setFooter({
            text: `${config.name} - ${user.displayName}`,
            iconURL: user.displayAvatarURL(),
          });

        embeds.push(embed);
      }

      // Send the completion message with all step embeds
      await channel.send({
        embeds: embeds,
        content: `<@${instance.userId}>`, // Ping the user
      });

      log.debug(`Posted ${stepsCompleted} step completion message(s) for item ${itemIndex}`);
    } catch (error) {
      log.error(`Error posting step completion message: ${error}`);
    }
  }
}
