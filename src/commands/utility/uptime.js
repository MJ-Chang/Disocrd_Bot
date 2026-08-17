const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { formatUptime, discordTimestamp } = require('../../utils/format');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('uptime').setDescription(t('查看機器人的運行時間', 'View bot uptime')),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(t('⏱️ 機器人運行狀態', '⏱️ Bot Status'))
        .addFields(
          { name: t('🔄 已運行時間', '🔄 Uptime'), value: formatUptime(client.uptime || 0), inline: true },
          { name: t('🚀 啟動時間', '🚀 Started'), value: discordTimestamp(client.startedAt, 'F'), inline: true },
          { name: t('📶 延遲', '📶 Ping'), value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢運行狀態時發生錯誤。', 'An error occurred while fetching uptime.'));
    }
  },
};
