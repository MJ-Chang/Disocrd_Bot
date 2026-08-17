const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('ping').setDescription(t('測試機器人延遲', 'Test bot latency')),
  cooldown: 3000,
  async run(interaction, client) {
    const sent = await interaction.reply({ content: t('🏓 測量中…', '🏓 Measuring…'), fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle(t('🏓 Pong！', '🏓 Pong!'))
      .addFields(
        { name: t('🔄 往返延遲', '🔄 Roundtrip'), value: `${roundtrip}ms`, inline: true },
        { name: t('💚 API 延遲', '💚 API Latency'), value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: t('📶 狀態', '📶 Status'), value: client.ws.status === 0 ? t('🟢 已連線', '🟢 Connected') : t(`🟡 狀態碼 ${client.ws.status}`, `🟡 Status ${client.ws.status}`), inline: true }
      )
      .setTimestamp();
    withFooter(embed, client);
    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
