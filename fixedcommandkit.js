"use strict";

export const patched = true;


var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ButtonKit: () => ButtonKit,
  CommandKit: () => CommandKit,
  createEffect: () => createEffect,
  createSignal: () => createSignal,
  defineConfig: () => defineConfig,
  getConfig: () => getConfig
});
module.exports = __toCommonJS(src_exports);

// src/utils/resolve-file-url.ts
var import_path = __toESM(require("path"));
function toFileURL(filePath) {
  const resolvedPath = import_path.default.resolve(filePath);
  return "file://" + resolvedPath.replace(/\\\\|\\/g, "/");
}

// src/utils/get-paths.ts
var import_path2 = __toESM(require("path"));
var import_promises = __toESM(require("fs/promises"));
async function getFilePaths(directory, nesting) {
  let filePaths = [];
  if (!directory)
    return filePaths;
  const files = await import_promises.default.readdir(directory, { withFileTypes: true });
  for (const file of files) {
    const filePath = import_path2.default.join(directory, file.name);
    if (file.isFile()) {
      filePaths.push(filePath);
    }
    if (nesting && file.isDirectory()) {
      filePaths = [...filePaths, ...await getFilePaths(filePath, true)];
    }
  }
  return filePaths;
}
async function getFolderPaths(directory, nesting) {
  let folderPaths = [];
  if (!directory)
    return folderPaths;
  const folders = await import_promises.default.readdir(directory, { withFileTypes: true });
  for (const folder of folders) {
    const folderPath = import_path2.default.join(directory, folder.name);
    if (folder.isDirectory()) {
      folderPaths.push(folderPath);
      if (nesting) {
        folderPaths = [...folderPaths, ...await getFolderPaths(folderPath, true)];
      }
    }
  }
  return folderPaths;
}

// src/utils/clone.ts
var import_rfdc = __toESM(require("rfdc"));
var clone = (0, import_rfdc.default)();

// src/utils/colors.ts
var resetColor = "\x1B[0m";
var colors_default = {
  reset: (text) => `${text}${resetColor}`,
  bright: (text) => `\x1B[1m${text}${resetColor}`,
  dim: (text) => `\x1B[2m${text}${resetColor}`,
  underscore: (text) => `\x1B[4m${text}${resetColor}`,
  blink: (text) => `\x1B[5m${text}${resetColor}`,
  reverse: (text) => `\x1B[7m${text}${resetColor}`,
  hidden: (text) => `\x1B[8m${text}${resetColor}`,
  black: (text) => `\x1B[30m${text}${resetColor}`,
  red: (text) => `\x1B[31m${text}${resetColor}`,
  green: (text) => `\x1B[32m${text}${resetColor}`,
  yellow: (text) => `\x1B[33m${text}${resetColor}`,
  blue: (text) => `\x1B[34m${text}${resetColor}`,
  magenta: (text) => `\x1B[35m${text}${resetColor}`,
  cyan: (text) => `\x1B[36m${text}${resetColor}`,
  white: (text) => `\x1B[37m${text}${resetColor}`,
  bgBlack: (text) => `\x1B[40m${text}${resetColor}`,
  bgRed: (text) => `\x1B[41m${text}${resetColor}`,
  bgGreen: (text) => `\x1B[42m${text}${resetColor}`,
  bgYellow: (text) => `\x1B[43m${text}${resetColor}`,
  bgBlue: (text) => `\x1B[44m${text}${resetColor}`,
  bgMagenta: (text) => `\x1B[45m${text}${resetColor}`,
  bgCyan: (text) => `\x1B[46m${text}${resetColor}`,
  bgWhite: (text) => `\x1B[47m${text}${resetColor}`
};

// src/handlers/command-handler/functions/loadCommandsWithRest.ts
async function loadCommandsWithRest(props) {
  if (props.reloading) {
    if (props.client.isReady()) {
      await handleLoading(
        props.client,
        props.commands,
        props.devGuildIds,
        props.reloading,
        props.type
      );
    } else {
      throw new Error(colors_default.red(`\u274C Cannot reload commands when client is not ready.`));
    }
  } else {
    props.client.once("ready", async (c) => {
      await handleLoading(c, props.commands, props.devGuildIds, props.reloading, props.type);
    });
  }
}
async function handleLoading(client, commands, devGuildIds, reloading, type) {
  commands = commands.filter((cmd) => !cmd.options?.deleted);
  const devOnlyCommands = commands.filter((cmd) => cmd.options?.devOnly);
  const globalCommands = commands.filter((cmd) => !cmd.options?.devOnly);
  if (type === "dev") {
    await loadDevCommands(client, devOnlyCommands, devGuildIds, reloading);
  } else if (type === "global") {
    await loadGlobalCommands(client, globalCommands, reloading);
  } else {
    await loadDevCommands(client, devOnlyCommands, devGuildIds, reloading);
    await loadGlobalCommands(client, globalCommands, reloading);
  }
}
async function loadGlobalCommands(client, commands, reloading) {
  const requestBody = commands.map((cmd) => cmd.data);
  await client.application.commands.set(requestBody).catch((error) => {
    console.log(
      colors_default.red(
        `\u274C Error ${reloading ? "reloading" : "loading"} global application commands.
`
      )
    );
    throw new Error(error);
  });
  console.log(
    colors_default.green(
      `\u2705 ${reloading ? "Reloaded" : "Loaded"} ${requestBody.length} global commands.`
    )
  );
}
async function loadDevCommands(client, commands, guildIds, reloading) {
  const requestBody = commands.map((cmd) => cmd.data);
  for (const guildId of guildIds) {
    const targetGuild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    if (!targetGuild) {
      console.log(
        `Couldn't ${reloading ? "reloading" : "loading"} commands in guild "${targetGuild}" - guild doesn't exist or client isn't part of the guild.`
      );
      continue;
    }
    await targetGuild.commands.set(requestBody).catch((error) => {
      console.log(
        colors_default.red(
          `\u274C Error ${reloading ? "reloading" : "loading"} developer application commands in guild "${targetGuild?.name || guildId}".
`
        )
      );
      throw new Error(error);
    });
    console.log(
      colors_default.green(
        `\u2705 ${reloading ? "Reloaded" : "Loaded"} ${requestBody.length} developer commands in guild "${targetGuild.name}".`
      )
    );
  }
}

// src/handlers/command-handler/utils/areSlashCommandsDifferent.ts
function areSlashCommandsDifferent(appCommand, localCommand) {
  if (!appCommand.options)
    appCommand.options = [];
  if (!localCommand.options)
    localCommand.options = [];
  if (!appCommand.description)
    appCommand.description = "";
  if (!localCommand.description)
    localCommand.description = "";
  if (localCommand.description !== appCommand.description || localCommand.options.length !== appCommand.options.length) {
    return true;
  }
}

// src/handlers/command-handler/functions/registerCommands.ts
async function registerCommands(props) {
  if (props.reloading) {
    if (props.client.isReady()) {
      await handleRegistration(props.client, props.commands, props.devGuildIds, props.type);
    } else {
      throw new Error(colors_default.red(`\u274C Cannot reload commands when client is not ready.`));
    }
  } else {
    props.client.once("ready", async (c) => {
      await handleRegistration(c, props.commands, props.devGuildIds, props.type);
    });
  }
}
async function handleRegistration(client, commands, devGuildIds, type) {
  const devOnlyCommands = commands.filter((cmd) => cmd.options?.devOnly);
  const globalCommands = commands.filter((cmd) => !cmd.options?.devOnly);
  if (type === "dev") {
    await registerDevCommands(client, devOnlyCommands, devGuildIds);
  } else if (type === "global") {
    await registerGlobalCommands(client, globalCommands);
  } else {
    await registerDevCommands(client, devOnlyCommands, devGuildIds);
    await registerGlobalCommands(client, globalCommands);
  }
}
async function registerGlobalCommands(client, commands) {
  const appCommandsManager = client.application.commands;
  await appCommandsManager.fetch();
  for (const command of commands) {
    const targetCommand = appCommandsManager.cache.find(
      (cmd) => cmd.name === command.data.name
    );
    if (command.options?.deleted) {
      if (!targetCommand) {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Command "${command.data.name}" is globally marked as deleted.`
          )
        );
      } else {
        await targetCommand.delete().catch((error) => {
          console.log(
            colors_default.red(`\u274C Failed to delete command "${command.data.name}" globally.`)
          );
          console.error(error);
        });
        console.log(colors_default.green(`\u{1F6AE} Deleted command "${command.data.name}" globally.`));
      }
      continue;
    }
    if (targetCommand) {
      const commandsAreDifferent = areSlashCommandsDifferent(targetCommand, command.data);
      if (commandsAreDifferent) {
        await targetCommand.edit(command.data).catch((error) => {
          console.log(
            colors_default.red(
              `\u274C Failed to edit command "${command.data.name}" globally.`
            )
          );
          console.error(error);
        });
        console.log(colors_default.green(`\u2705 Edited command "${command.data.name}" globally.`));
        continue;
      }
    }
    if (targetCommand)
      continue;
    await appCommandsManager.create(command.data).catch((error) => {
      console.log(
        colors_default.red(`\u274C Failed to register command "${command.data.name}" globally.`)
      );
      console.error(error);
    });
    console.log(colors_default.green(`\u2705 Registered command "${command.data.name}" globally.`));
  }
}
async function registerDevCommands(client, commands, guildIds) {
  const devGuilds = [];
  for (const guildId of guildIds) {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    if (!guild) {
      console.log(
        colors_default.yellow(
          `\u23E9 Ignoring: Guild ${guildId} does not exist or client isn't in this guild.`
        )
      );
      continue;
    }
    devGuilds.push(guild);
  }
  const guildCommandsManagers = [];
  for (const guild of devGuilds) {
    const guildCommandsManager = guild.commands;
    await guildCommandsManager.fetch();
    guildCommandsManagers.push(guildCommandsManager);
  }
  for (const command of commands) {
    for (const guildCommands of guildCommandsManagers) {
      const targetCommand = guildCommands.cache.find((cmd) => cmd.name === command.data.name);
      if (command.options?.deleted) {
        if (!targetCommand) {
          console.log(
            colors_default.yellow(
              `\u23E9 Ignoring: Command "${command.data.name}" is marked as deleted for ${guildCommands.guild.name}.`
            )
          );
        } else {
          await targetCommand.delete().catch((error) => {
            console.log(
              colors_default.red(
                `\u274C Failed to delete command "${command.data.name}" in ${guildCommands.guild.name}.`
              )
            );
            console.error(error);
          });
          console.log(
            colors_default.green(
              `\u{1F6AE} Deleted command "${command.data.name}" in ${guildCommands.guild.name}.`
            )
          );
        }
        continue;
      }
      if (targetCommand) {
        const commandsAreDifferent = areSlashCommandsDifferent(targetCommand, command.data);
        if (commandsAreDifferent) {
          await targetCommand.edit(command.data).catch((error) => {
            console.log(
              colors_default.red(
                `\u274C Failed to edit command "${command.data.name}" in ${guildCommands.guild.name}.`
              )
            );
            console.error(error);
          });
          console.log(
            colors_default.green(
              `\u2705 Edited command "${command.data.name}" in ${guildCommands.guild.name}.`
            )
          );
          continue;
        }
      }
      if (targetCommand)
        continue;
      await guildCommands.create(command.data).catch((error) => {
        console.log(
          colors_default.red(
            `\u274C Failed to register command "${command.data.name}" in ${guildCommands.guild.name}.`
          )
        );
        console.error(error);
      });
      console.log(
        colors_default.green(
          `\u2705 Registered command "${command.data.name}" in ${guildCommands.guild.name}.`
        )
      );
    }
  }
}

// src/handlers/command-handler/validations/devOnly.ts
function devOnly_default({ interaction, targetCommand, handlerData }) {
  if (interaction.isAutocomplete())
    return;
  if (targetCommand.options?.devOnly) {
    if (interaction.inGuild() && !handlerData.devGuildIds.includes(interaction.guildId)) {
      interaction.reply({
        content: "\u274C This command can only be used inside development servers.",
        ephemeral: true
      });
      return true;
    }
    const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
    const memberRoles = guildMember?.roles.cache;
    let hasDevRole = false;
    memberRoles?.forEach((role) => {
      if (handlerData.devRoleIds.includes(role.id)) {
        hasDevRole = true;
      }
    });
    const isDevUser = handlerData.devUserIds.includes(interaction.user.id) || hasDevRole;
    if (!isDevUser) {
      interaction.reply({
        content: "\u274C This command can only be used by developers.",
        ephemeral: true
      });
      return true;
    }
  }
}

// src/handlers/command-handler/validations/permissions.ts
var import_discord = require("discord.js");
function permissions_default({ interaction, targetCommand }) {
  if (interaction.isAutocomplete())
    return;
  const userPermissions = interaction.memberPermissions;
  let userPermissionsRequired = targetCommand.options?.userPermissions;
  let missingUserPermissions = [];
  if (typeof userPermissionsRequired === "string") {
    userPermissionsRequired = [userPermissionsRequired];
  }
  const botPermissions = interaction.guild?.members.me?.permissions;
  let botPermissionsRequired = targetCommand.options?.botPermissions;
  let missingBotPermissions = [];
  if (typeof botPermissionsRequired === "string") {
    botPermissionsRequired = [botPermissionsRequired];
  }
  if (!userPermissionsRequired?.length && !botPermissionsRequired?.length) {
    return;
  }
  if (userPermissions && userPermissionsRequired) {
    for (const permission of userPermissionsRequired) {
      const hasPermission = userPermissions.has(permission);
      if (!hasPermission) {
        missingUserPermissions.push(permission);
      }
    }
  }
  if (botPermissions && botPermissionsRequired) {
    for (const permission of botPermissionsRequired) {
      const hasPermission = botPermissions.has(permission);
      if (!hasPermission) {
        missingBotPermissions.push(permission);
      }
    }
  }
  if (!missingUserPermissions.length && !missingBotPermissions.length) {
    return;
  }
  const pattern = /([a-z])([A-Z])|([A-Z]+)([A-Z][a-z])/g;
  missingUserPermissions = missingUserPermissions.map((str) => str.replace(pattern, "$1$3 $2$4"));
  missingBotPermissions = missingBotPermissions.map((str) => str.replace(pattern, "$1$3 $2$4"));
  let embedDescription = "";
  const formatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const getPermissionWord = (permissions) => permissions.length === 1 ? "permission" : "permissions";
  if (missingUserPermissions.length) {
    const formattedPermissions = missingUserPermissions.map((p) => `\`${p}\``);
    const permissionsString = formatter.format(formattedPermissions);
    embedDescription += `- You must have the ${permissionsString} ${getPermissionWord(
      missingUserPermissions
    )} to be able to run this command.
`;
  }
  if (missingBotPermissions.length) {
    const formattedPermissions = missingBotPermissions.map((p) => `\`${p}\``);
    const permissionsString = formatter.format(formattedPermissions);
    embedDescription += `- I must have the ${permissionsString} ${getPermissionWord(
      missingBotPermissions
    )} to be able to execute this command.
`;
  }
  const embed = new import_discord.EmbedBuilder().setTitle(`:x: Missing permissions!`).setDescription(embedDescription).setColor("Red");
  interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

// src/handlers/command-handler/validations/index.ts
var validations_default = [devOnly_default, permissions_default];

// src/handlers/command-handler/CommandHandler.ts
var CommandHandler = class {
  #data;
  constructor({ ...options }) {
    this.#data = {
      ...options,
      builtInValidations: [],
      commands: []
    };
  }
  async init() {
    await this.#buildCommands();
    this.#buildBuiltInValidations();
    const devOnlyCommands = this.#data.commands.filter((cmd) => cmd.options?.devOnly);
    if (devOnlyCommands.length && !this.#data.devGuildIds.length) {
      console.log(
        colors_default.yellow(
          '\u2139\uFE0F Warning: You have commands marked as "devOnly", but "devGuildIds" have not been set.'
        )
      );
    }
    if (devOnlyCommands.length && !this.#data.devUserIds.length && !this.#data.devRoleIds.length) {
      console.log(
        colors_default.yellow(
          '\u2139\uFE0F Warning: You have commands marked as "devOnly", but "devUserIds" or "devRoleIds" have not been set.'
        )
      );
    }
    if (this.#data.bulkRegister) {
      await loadCommandsWithRest({
        client: this.#data.client,
        devGuildIds: this.#data.devGuildIds,
        commands: this.#data.commands
      });
    } else {
      await registerCommands({
        client: this.#data.client,
        devGuildIds: this.#data.devGuildIds,
        commands: this.#data.commands
      });
    }
    this.handleCommands();
  }
  async #buildCommands() {
    const allowedExtensions = /\.(js|mjs|cjs|ts)$/i;
    const paths = await getFilePaths(this.#data.commandsPath, true);
    const commandFilePaths = paths.filter((path3) => allowedExtensions.test(path3));
    for (const commandFilePath of commandFilePaths) {
      const modulePath = toFileURL(commandFilePath);
      const importedObj = await import(`${modulePath}?t=${Date.now()}`);
      let commandObj = clone(importedObj);
      if (typeof module !== "undefined" && typeof require !== "undefined" && commandFilePath) {
        try {
          delete require.cache[require.resolve(commandFilePath)];
        } catch (error) {
          // Ignore resolve errors for non-resolvable paths
        }
      }
      const compactFilePath = commandFilePath.split(process.cwd())[1] || commandFilePath;
      if (commandObj.default)
        commandObj = commandObj.default;
      if (importedObj.default) {
        commandObj.data = importedObj.default.data;
      } else {
        commandObj.data = importedObj.data;
      }
      if (!commandObj.data) {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Command ${compactFilePath} does not export "data".`
          )
        );
        continue;
      }
      if (!commandObj.data.name) {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Command ${compactFilePath} does not export "data.name".`
          )
        );
        continue;
      }
      if (!commandObj.run) {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Command ${commandObj.data.name} does not export "run".`
          )
        );
        continue;
      }
      if (typeof commandObj.run !== "function") {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Command ${commandObj.data.name} does not export "run" as a function.`
          )
        );
        continue;
      }
      commandObj.filePath = commandFilePath;
      let commandCategory = commandFilePath.split(this.#data.commandsPath)[1]?.replace(/\\\\|\\/g, "/").split("/")[1] || null;
      if (commandCategory && allowedExtensions.test(commandCategory)) {
        commandObj.category = null;
      } else {
        commandObj.category = commandCategory;
      }
      if (commandObj.options?.guildOnly) {
        console.log(
          colors_default.yellow(
            `\u2139\uFE0F Deprecation warning: The command "${commandObj.data.name}" uses "options.guildOnly", which will be deprecated soon. Use "data.dm_permission" instead.`
          )
        );
      }
      this.#data.commands.push(commandObj);
    }
  }
  #buildBuiltInValidations() {
    for (const builtInValidationFunction of validations_default) {
      this.#data.builtInValidations.push(builtInValidationFunction);
    }
  }
  handleCommands() {
    this.#data.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand() && !interaction.isAutocomplete())
        return;
      const isAutocomplete = interaction.isAutocomplete();
      const targetCommand = this.#data.commands.find(
        (cmd) => cmd.data.name === interaction.commandName
      );
      if (!targetCommand)
        return;
      const { data, options, run, autocomplete, ...rest } = targetCommand;
      if (isAutocomplete && !autocomplete)
        return;
      const commandObj = {
        data: targetCommand.data,
        options: targetCommand.options,
        ...rest
      };
      if (this.#data.validationHandler) {
        let canRun2 = true;
        for (const validationFunction of this.#data.validationHandler.validations) {
          const stopValidationLoop = await validationFunction({
            interaction,
            commandObj,
            client: this.#data.client,
            handler: this.#data.commandkitInstance
          });
          if (stopValidationLoop) {
            canRun2 = false;
            break;
          }
        }
        if (!canRun2)
          return;
      }
      let canRun = true;
      if (!this.#data.skipBuiltInValidations) {
        for (const validation of this.#data.builtInValidations) {
          const stopValidationLoop = validation({
            targetCommand,
            interaction,
            handlerData: this.#data
          });
          if (stopValidationLoop) {
            canRun = false;
            break;
          }
        }
      }
      if (!canRun)
        return;
      const context2 = {
        interaction,
        client: this.#data.client,
        handler: this.#data.commandkitInstance
      };
      await targetCommand[isAutocomplete ? "autocomplete" : "run"](context2);
    });
  }
  get commands() {
    return this.#data.commands;
  }
  async reloadCommands(type) {
    if (!this.#data.commandsPath) {
      throw new Error(
        'Cannot reload commands as "commandsPath" was not provided when instantiating CommandKit.'
      );
    }
    this.#data.commands = [];
    await this.#buildCommands();
    if (this.#data.bulkRegister) {
      await loadCommandsWithRest({
        client: this.#data.client,
        devGuildIds: this.#data.devGuildIds,
        commands: this.#data.commands,
        reloading: true,
        type
      });
    } else {
      await registerCommands({
        client: this.#data.client,
        devGuildIds: this.#data.devGuildIds,
        commands: this.#data.commands,
        reloading: true,
        type
      });
    }
  }
};

// src/handlers/event-handler/EventHandler.ts
var EventHandler = class {
  #data;
  constructor({ ...options }) {
    this.#data = {
      ...options,
      events: []
    };
  }
  async init() {
    await this.#buildEvents();
    this.#registerEvents();
  }
  async #buildEvents() {
    const eventFolderPaths = await getFolderPaths(this.#data.eventsPath);
    for (const eventFolderPath of eventFolderPaths) {
      const eventName = eventFolderPath.replace(/\\\\|\\/g, "/").split("/").pop();
      const allowedExtensions = /\.(js|mjs|cjs|ts)$/i;
      const eventPaths = await getFilePaths(eventFolderPath, true);
      const eventFilePaths = eventPaths.filter((path3) => allowedExtensions.test(path3));
      const eventObj = {
        name: eventName,
        functions: []
      };
      this.#data.events.push(eventObj);
      for (const eventFilePath of eventFilePaths) {
        const modulePath = toFileURL(eventFilePath);
        let importedFunction = (await import(`${modulePath}?t=${Date.now()}`)).default;
        let eventFunction = clone(importedFunction);
        if (typeof module !== "undefined" && typeof require !== "undefined" && eventFilePath) {
          try {
            delete require.cache[require.resolve(eventFilePath)];
          } catch (error) {
            // Ignore resolve errors for non-resolvable paths
          }
        }
        if (eventFunction?.default) {
          eventFunction = eventFunction.default;
        }
        const compactFilePath = eventFilePath.split(process.cwd())[1] || eventFilePath;
        if (typeof eventFunction !== "function") {
          console.log(
            colors_default.yellow(
              `\u23E9 Ignoring: Event ${compactFilePath} does not export a function.`
            )
          );
          continue;
        }
        eventObj.functions.push(eventFunction);
      }
    }
  }
  #registerEvents() {
    const client = this.#data.client;
    const handler = this.#data.commandKitInstance;
    for (const eventObj of this.#data.events) {
      client.on(eventObj.name, async (...params) => {
        for (const eventFunction of eventObj.functions) {
          const stopEventLoop = await eventFunction(...params, client, handler);
          if (stopEventLoop) {
            break;
          }
        }
      });
    }
  }
  get events() {
    return this.#data.events;
  }
  async reloadEvents(commandHandler) {
    if (!this.#data.eventsPath) {
      throw new Error(
        'Cannot reload events as "eventsPath" was not provided when instantiating CommandKit.'
      );
    }
    this.#data.events = [];
    await this.#buildEvents();
    this.#data.client.removeAllListeners();
    this.#registerEvents();
    commandHandler?.handleCommands();
  }
};

// src/handlers/validation-handler/ValidationHandler.ts
var ValidationHandler = class {
  #data;
  constructor({ ...options }) {
    this.#data = {
      ...options,
      validations: []
    };
  }
  async init() {
    this.#data.validations = await this.#buildValidations();
  }
  async #buildValidations() {
    const allowedExtensions = /\.(js|mjs|cjs|ts)$/i;
    const validationPaths = await getFilePaths(this.#data.validationsPath, true);
    const validationFilePaths = validationPaths.filter((path3) => allowedExtensions.test(path3));
    const validationFunctions = [];
    for (const validationFilePath of validationFilePaths) {
      const modulePath = toFileURL(validationFilePath);
      let importedFunction = (await import(`${modulePath}?t=${Date.now()}`)).default;
      let validationFunction = clone(importedFunction);
      if (typeof module !== "undefined" && typeof require !== "undefined" && validationFilePath) {
        try {
          delete require.cache[require.resolve(validationFilePath)];
        } catch (error) {
          // Ignore resolve errors for non-resolvable paths
        }
      }
      if (validationFunction?.default) {
        validationFunction = validationFunction.default;
      }
      const compactFilePath = validationFilePath.split(process.cwd())[1] || validationFilePath;
      if (typeof validationFunction !== "function") {
        console.log(
          colors_default.yellow(
            `\u23E9 Ignoring: Validation ${compactFilePath} does not export a function.`
          )
        );
        continue;
      }
      validationFunctions.push(validationFunction);
    }
    return validationFunctions;
  }
  get validations() {
    return this.#data.validations;
  }
  async reloadValidations() {
    if (!this.#data.validationsPath) {
      throw new Error(
        'Cannot reload validations as "validationsPath" was not provided when instantiating CommandKit.'
      );
    }
    const newValidations = await this.#buildValidations();
    this.#data.validations = newValidations;
  }
};

// src/CommandKit.ts
var CommandKit = class {
  #data;
  /**
   * Create a new command and event handler with CommandKit.
   *
   * @param options - The default CommandKit configuration.
   * @see {@link https://commandkit.js.org/docs/commandkit-setup}
   */
  constructor(options) {
    if (!options.client) {
      throw new Error(colors_default.red('"client" is required when instantiating CommandKit.'));
    }
    if (options.validationsPath && !options.commandsPath) {
      throw new Error(
        colors_default.red('"commandsPath" is required when "validationsPath" is set.')
      );
    }
    this.#data = options;
    this.#init();
  }
  /**
   * (Private) Initialize CommandKit.
   */
  async #init() {
    if (this.#data.eventsPath) {
      const eventHandler = new EventHandler({
        client: this.#data.client,
        eventsPath: this.#data.eventsPath,
        commandKitInstance: this
      });
      await eventHandler.init();
      this.#data.eventHandler = eventHandler;
    }
    if (this.#data.validationsPath) {
      const validationHandler = new ValidationHandler({
        validationsPath: this.#data.validationsPath
      });
      await validationHandler.init();
      this.#data.validationHandler = validationHandler;
    }
    if (this.#data.commandsPath) {
      const commandHandler = new CommandHandler({
        client: this.#data.client,
        commandsPath: this.#data.commandsPath,
        devGuildIds: this.#data.devGuildIds || [],
        devUserIds: this.#data.devUserIds || [],
        devRoleIds: this.#data.devRoleIds || [],
        validationHandler: this.#data.validationHandler,
        skipBuiltInValidations: this.#data.skipBuiltInValidations || false,
        commandkitInstance: this,
        bulkRegister: this.#data.bulkRegister || false
      });
      await commandHandler.init();
      this.#data.commandHandler = commandHandler;
    }
  }
  /**
   * Updates application commands with the latest from "commandsPath".
   */
  async reloadCommands(type) {
    if (!this.#data.commandHandler)
      return;
    await this.#data.commandHandler.reloadCommands(type);
  }
  /**
   * Updates application events with the latest from "eventsPath".
   */
  async reloadEvents() {
    if (!this.#data.eventHandler)
      return;
    await this.#data.eventHandler.reloadEvents(this.#data.commandHandler);
  }
  /**
   * Updates application command validations with the latest from "validationsPath".
   */
  async reloadValidations() {
    if (!this.#data.validationHandler)
      return;
    await this.#data.validationHandler.reloadValidations();
  }
  /**
   * @returns An array of objects of all the commands that CommandKit is handling.
   */
  get commands() {
    if (!this.#data.commandHandler) {
      return [];
    }
    const commands = this.#data.commandHandler.commands.map((cmd) => {
      const { run, autocomplete, ...command } = cmd;
      return command;
    });
    return commands;
  }
  /**
   * @returns The path to the commands folder which was set when instantiating CommandKit.
   */
  get commandsPath() {
    return this.#data.commandsPath;
  }
  /**
   * @returns The path to the events folder which was set when instantiating CommandKit.
   */
  get eventsPath() {
    return this.#data.eventsPath;
  }
  /**
   * @returns The path to the validations folder which was set when instantiating CommandKit.
   */
  get validationsPath() {
    return this.#data.validationsPath;
  }
  /**
   * @returns An array of all the developer user IDs which was set when instantiating CommandKit.
   */
  get devUserIds() {
    return this.#data.devUserIds || [];
  }
  /**
   * @returns An array of all the developer guild IDs which was set when instantiating CommandKit.
   */
  get devGuildIds() {
    return this.#data.devGuildIds || [];
  }
  /**
   * @returns An array of all the developer role IDs which was set when instantiating CommandKit.
   */
  get devRoleIds() {
    return this.#data.devRoleIds || [];
  }
};

// src/components/ButtonKit.ts
var import_discord2 = require("discord.js");
var ButtonKit = class extends import_discord2.ButtonBuilder {
  #onClickHandler = null;
  #onEndHandler = null;
  #contextData = null;
  #collector = null;
  /**
   * Sets up an inline interaction collector for this button. This collector by default allows as many interactions as possible if it is actively used.
   * If unused, this expires after 24 hours or custom time if specified.
   * @param handler The handler to run when the button is clicked
   * @param data The context data to use for the interaction collector
   * @returns This button
   * @example
   * ```ts
   * const button = new ButtonKit()
   *   .setLabel('Click me')
   *   .setStyle(ButtonStyle.Primary)
   *   .setCustomId('click_me');
   *
   * const row = new ActionRowBuilder().addComponents(button);
   *
   * const message = await channel.send({ content: 'Click the button', components: [row] });
   *
   * button.onClick(async (interaction) => {
   *   await interaction.reply('You clicked me!');
   * }, { message });
   *
   * // Remove onClick handler and destroy the interaction collector
   * button.onClick(null);
   * ```
   */
  onClick(handler, data) {
    if (this.data.style === import_discord2.ButtonStyle.Link) {
      throw new TypeError('Cannot setup "onClick" handler on link buttons.');
    }
    if (!handler) {
      throw new TypeError('Cannot setup "onClick" without a handler function parameter.');
    }
    this.#destroyCollector();
    this.#onClickHandler = handler;
    if (data)
      this.#contextData = data;
    this.#setupInteractionCollector();
    return this;
  }
  onEnd(handler) {
    if (!handler) {
      throw new TypeError('Cannot setup "onEnd" without a handler function parameter.');
    }
    this.#onEndHandler = handler;
    return this;
  }
  #setupInteractionCollector() {
    if (!this.#contextData || !this.#onClickHandler)
      return;
    const message = this.#contextData.message;
    if (!message) {
      throw new TypeError(
        'Cannot setup "onClick" handler without a message in the context data.'
      );
    }
    if ("customId" in this.data && !this.data.customId) {
      throw new TypeError('Cannot setup "onClick" handler on a button without a custom id.');
    }
    const data = {
      time: 864e5,
      autoReset: true,
      ...this.#contextData
    };
    const collector = this.#collector = message.createMessageComponentCollector({
      filter: (interaction) => interaction.customId === this.data.custom_id && interaction.message.id === message.id,
      componentType: import_discord2.ComponentType.Button,
      ...data
    });
    this.#collector.on("collect", (interaction) => {
      const handler = this.#onClickHandler;
      if (!handler)
        return this.#destroyCollector();
      if (!this.#collector) {
        return collector.stop("destroyed");
      }
      if (data.autoReset) {
        this.#collector.resetTimer();
      }
      return handler(interaction);
    });
    this.#collector.on("end", () => {
      this.#destroyCollector();
      this.#onEndHandler?.();
    });
  }
  #destroyCollector() {
    this.#collector?.stop("end");
    this.#collector?.removeAllListeners();
    this.#collector = null;
    this.#contextData = null;
    this.#onClickHandler = null;
  }
};

// src/config.ts
var globalConfig = {
  envExtra: true,
  outDir: "dist",
  watch: true,
  clearRestartLogs: true,
  minify: false,
  sourcemap: false,
  nodeOptions: [],
  antiCrash: true,
  requirePolyfill: true
};
function getConfig() {
  return globalConfig;
}
var requiredProps = ["src", "main"];
function defineConfig(config) {
  for (const prop of requiredProps) {
    if (!config[prop]) {
      throw new Error(`[CommandKit Config] Missing required config property: ${prop}`);
    }
  }
  globalConfig = {
    ...globalConfig,
    ...config
  };
  return globalConfig;
}

// src/utils/signal.ts
var context = [];
function createSignal(value) {
  const subscribers = /* @__PURE__ */ new Set();
  let disposed = false;
  let val = value instanceof Function ? value() : value;
  const getter = () => {
    if (!disposed) {
      const running = getCurrentObserver();
      if (running)
        subscribers.add(running);
    }
    return val;
  };
  const setter = (newValue) => {
    if (disposed)
      return;
    val = newValue instanceof Function ? newValue(val) : newValue;
    for (const subscriber of subscribers) {
      subscriber();
    }
  };
  const dispose = () => {
    subscribers.clear();
    disposed = true;
  };
  return [getter, setter, dispose];
}
function createEffect(callback) {
  const execute = () => {
    context.push(execute);
    try {
      callback();
    } finally {
      context.pop();
    }
  };
  execute();
}
function getCurrentObserver() {
  return context[context.length - 1];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ButtonKit,
  CommandKit,
  createEffect,
  createSignal,
  defineConfig,
  getConfig
});
