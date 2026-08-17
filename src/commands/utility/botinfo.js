const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { formatDuration, formatNumber } = require('../../utils/format');
const { withFooter } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('botinfo').setDescription(t('查看機器人的基本資訊', 'View bot information')),
  cooldown: 5000,
  async run(interaction, client) {
    const pkg = require('../../../package.json');
    const uptime = formatDuration(client.uptime || 0);
    const embed = new EmbedBuilder()
      .setColor(client.config.colorMain)
      .setTitle(t('🤖 機器人資訊', '🤖 Bot Info'))
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: t('名稱', 'Name'), value: client.user.tag, inline: true },
        { name: 'ID', value: client.user.id, inline: true },
        { name: t('上線時間', 'Uptime'), value: uptime, inline: true },
        { name: t('伺服器數', 'Servers'), value: formatNumber(client.guilds.cache.size), inline: true },
        { name: t('指令數', 'Commands'), value: formatNumber(client.commands.size), inline: true },
        { name: t('使用者數', 'Users'), value: formatNumber(client.users.cache.size), inline: true },
        { name: t('版本', 'Version'), value: `discord.js v${require('discord.js').version}`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: t('延遲', 'Latency'), value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setDescription(t(`一個功能完整的 Discord 機器人，版本 **v${pkg.version}**`, `A feature-rich Discord bot, version **v${pkg.version}**`));
    withFooter(embed, client, t(`啟動於 ${new Date(client.startedAt).toLocaleString('zh-TW')}`, `Started at ${new Date(client.startedAt).toLocaleString('en-US')}`));
    await interaction.reply({ embeds: [embed] });
  },
};
