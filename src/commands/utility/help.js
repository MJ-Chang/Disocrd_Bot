const { MessageFlags, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { CategoryLabels } = require('../../utils/constants');
const { withFooter } = require('../../utils/embeds');
const { isAdmin, isModerator } = require('../../core/permissions');
const { t } = require('../../utils/i18n');

/** 依查看者權限過濾指令（一般成員看不到管理/管理員專用指令） */
function visibleCommands(client, member) {
  const canAdmin = isAdmin(member);
  const canMod = isModerator(member);
  return [...client.commands.values()].filter((c) => {
    if (c.adminOnly && !canAdmin) return false;
    if (c.modOnly && !canMod) return false;
    return true;
  });
}

/** 依分類建立 embed */
function renderCategory(client, category, commands) {
  const embed = new EmbedBuilder()
    .setColor(client.config.colorMain)
    .setTitle(`${CategoryLabels[category] || category} ${t('指令', 'Commands')}`)
    .setDescription(
      commands
        .map((c) => `\`/${c.data.name}\` — ${c.data.description || t('（無說明）', '(no description)')}`)
        .join('\n') || t('此分類沒有指令。', 'No commands in this category.')
    );
  withFooter(embed, client, t(`共 ${commands.length} 個指令`, `${commands.length} commands`));
  return embed;
}

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(t('查看機器人的所有指令與說明', 'View all commands and help')),
  cooldown: 5000,
  async run(interaction, client) {
    const commands = visibleCommands(client, interaction.member);
    const grouped = {};
    for (const c of commands) {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    }
    const categories = Object.keys(grouped).sort();

    const embed = new EmbedBuilder()
      .setColor(client.config.colorMain)
      .setTitle(t('📖 指令總覽', '📖 Command Overview'))
      .setDescription(
        t(
          `我是 **${client.user.username}**，一個功能完整的 Discord 機器人！\n你目前可以使用 **${commands.length}** 個指令，分為 ${categories.length} 個分類。\n\n使用下方的選單查看各分類的指令，或直接輸入 \`/\` 瀏覽全部指令。`,
          `I'm **${client.user.username}**, a feature-rich Discord bot!\nYou can use **${commands.length}** commands in ${categories.length} categories.\n\nUse the menu below to browse, or type \`/\` to see everything.`
        )
      )
      .addFields(
        categories.map((c) => ({
          name: `${CategoryLabels[c] || c}`,
          value: t(`${grouped[c].length} 個指令`, `${grouped[c].length} commands`),
          inline: true,
        }))
      );
    withFooter(embed, client, t('選擇分類查看詳細指令', 'Pick a category to browse commands'));

    const select = new StringSelectMenuBuilder()
      .setCustomId('help:category')
      .setPlaceholder(t('選擇一個分類…', 'Choose a category…'))
      .addOptions(
        categories.map((c) => ({
          label: CategoryLabels[c] || c,
          value: c,
          description: t(`${grouped[c].length} 個指令`, `${grouped[c].length} commands`),
        }))
      );

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(select)],
      flags: MessageFlags.Ephemeral,
    });
  },

  /** 處理 help 分類選單（由 interactionCreate 呼叫） */
  async handleCategorySelect(client, interaction) {
    const category = interaction.values[0];
    const commands = visibleCommands(client, interaction.member).filter((c) => c.category === category);
    await interaction.update({
      embeds: [renderCategory(client, category, commands)],
      components: interaction.message.components,
    });
    return true;
  },
};
