const { SlashCommandBuilder } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');
const afkFeature = require('../../features/afk');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription(t('設定 AFK 狀態（發言或被打擾時會自動通知）', 'Set AFK status (auto-notified when mentioned)'))
    .addStringOption((o) => o.setName('reason').setDescription(t('AFK 原因（可選）', 'AFK reason (optional)'))),
  cooldown: 5000,
  async run(interaction, client) {
    const reason = interaction.options.getString('reason') || '';
    const ok = await afkFeature.setAFK(client, interaction.user.id, interaction.guild.id, reason);
    if (!ok) return sendError(interaction, t('設定 AFK 失敗，請稍後再試。', 'Failed to set AFK. Please try again later.'));
    return sendSuccess(interaction, t(
      `已設定 AFK 狀態。${reason ? `\n📝 原因：${reason}` : ''}\n當你再次發言時會自動移除。`,
      `AFK status set.${reason ? `\n📝 Reason: ${reason}` : ''}\nIt will be removed automatically when you speak again.`
    ));
  },
};
