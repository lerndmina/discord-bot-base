import { ActionRowBuilder, ButtonBuilder, ButtonComponent, ButtonComponentData } from "discord.js";

export default function (buttons: ButtonBuilder[]) {
  const components: any = [];
  var actionRow = new ActionRowBuilder();

  for (var a = 0; a < buttons.length && a < 25; a++) {
    if (a % 5 == 0 && a > 0) {
      components.push(actionRow);
      actionRow = new ActionRowBuilder();
    }
    actionRow.addComponents(buttons[a]);
  }

  if (actionRow.components.length > 0) components.push(actionRow);

  return components as any;
}
