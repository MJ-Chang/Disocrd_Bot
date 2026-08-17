const { SlashCommandBuilder } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');
const statsFeature = require('../../features/stats');

module.exports = {
  category: 'config',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription(t('伺服器統計頻道（成員/線上/加成數）', 'Server stats channels (members/online/boosters)'))
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription(t('建立統計頻道', 'Create stats channels'))
        .addChannelOption((o) => o.setName('category').setDescription(t('放置統計頻道的分類', 'Category for stats channels')).setRequired(true))
    )
    .addSubcommand((s) => s.setName('refresh').setDescription(t('立即刷新統計頻道', 'Refresh stats channels now')))
    .addSubcommand((s) => s.setName('disable').setDescription(t('停用並刪除統計頻道', 'Disable and delete stats channels'))),
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      const category = interaction.options.getChannel('category');
      if (!category.isCategory()) return sendError(interaction, t('請選擇一個「分類」頻道。', 'Please pick a category channel.'));
      try {
        await statsFeature.setup(client, guild, category);
        return sendSuccess(interaction, t(`已在分類 **${category.name}** 建立 5 個統計頻道，每 10 分鐘自動更新。`, `Created 5 stats channels in category **${category.name}**; auto-updates every 10 minutes.`));
      } catch (e) {
        return sendError(interaction, t(`建立統計頻道失敗：${e.message}`, `Failed to create stats channels: ${e.message}`));
      }
    }

    if (sub === 'refresh') {
      try {
        await statsFeature.refresh(client, guild);
        return sendSuccess(interaction, t('已刷新統計頻道。', 'Stats channels refreshed.'));
      } catch (e) {
        return sendError(interaction, t(`刷新失敗：${e.message}`, `Refresh failed: ${e.message}`));
      }
    }

    if (sub === 'disable') {
      await statsFeature.disable(client, guild);
      return sendSuccess(interaction, t('已停用統計頻道並刪除相關頻道。', 'Stats channels disabled and deleted.'));
    }
  },
};
