const { MessageFlags } = require('discord.js');
const { logger } = require('../utils/logger');
const { requireAdmin, requireMod } = require('../core/permissions');
const { t } = require('../utils/i18n');

/** 元件互動（按鈕/選單/Modal）會先嘗試交給這些功能模組處理 */
const COMPONENT_FEATURES = [
  'verification',
  'tickets',
  'giveaways',
  'suggestions',
  'tempVoice',
  'polls',
  'music',
];

async function handleComponent(client, interaction) {
  const customId = interaction.customId || '';

  // help 分類選單由 help 指令自己處理
  if (customId === 'help:category') {
    return require('../commands/utility/help').handleCategorySelect(client, interaction);
  }

  for (const name of COMPONENT_FEATURES) {
    let mod;
    try {
      mod = require(`../features/${name}`);
    } catch (e) {
      continue;
    }
    if (interaction.isButton() && typeof mod.handleButton === 'function') {
      if (await mod.handleButton(client, interaction)) return true;
    } else if (interaction.isStringSelectMenu() && typeof mod.handleSelectMenu === 'function') {
      if (await mod.handleSelectMenu(client, interaction)) return true;
    } else if (interaction.isModalSubmit() && typeof mod.handleModal === 'function') {
      if (await mod.handleModal(client, interaction)) return true;
    }
  }
  return false;
}

module.exports = {
  name: 'interactionCreate',
  async run(client, interaction) {
    try {
      // ===== 斜線指令 =====
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || typeof command.run !== 'function') return;

        if (command.ownerOnly && interaction.user.id !== client.config.ownerId) {
          return interaction.reply({ content: t('❌ 此指令僅限機器人擁有者使用。', '❌ This command is restricted to the bot owner.'), flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        if (command.adminOnly && !(await requireAdmin(interaction))) return;
        if (command.modOnly && !(await requireMod(interaction))) return;

        const cooldownMs = command.cooldown || 0;
        if (cooldownMs > 0) {
          const remaining = client.cooldowns.remaining(interaction.user.id, command.data.name);
          if (remaining > 0) {
            const { formatDuration } = require('../utils/format');
            return interaction
              .reply({ content: t(`⏳ 指令冷卻中，請 ${formatDuration(remaining)} 後再試。`, `⏳ Command on cooldown. Try again in ${formatDuration(remaining)}.`), flags: MessageFlags.Ephemeral })
              .catch(() => {});
          }
          client.cooldowns.set(interaction.user.id, command.data.name, cooldownMs);
        }

        await command.run(interaction, client);
        return;
      }

      // ===== 元件互動（按鈕 / 選單 / Modal） =====
      if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        const handled = await handleComponent(client, interaction);
        if (!handled) {
          logger.debug('interaction', `未處理的元件：${interaction.customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: t('❌ 此按鈕/選單已失效或不存在。', '❌ This button/menu is no longer valid.'), flags: MessageFlags.Ephemeral }).catch(() => {});
          }
        }
        return;
      }
    } catch (e) {
      logger.error('interaction', `處理互動失敗（${interaction.customId || interaction.commandName}）：\n${e.stack || e.message}`);
      try {
        const payload = { content: t('❌ 執行時發生錯誤，請稍後再試。', '❌ An error occurred. Please try again later.'), flags: MessageFlags.Ephemeral };
        if (!interaction.replied && !interaction.deferred) await interaction.reply(payload);
        else await interaction.followUp(payload);
      } catch (e2) {
        /* 忽略二次錯誤 */
      }
    }
  },
};
