const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { Colors } = require('../../utils/constants');
const { formatNumber } = require('../../utils/format');
const { withFooter, sendError } = require('../../utils/embeds');

/** 取得貨幣符號 */
async function currency(client, guildId) {
  const s = await client.settings.get(guildId);
  return s.economy.currency || '🪙';
}

module.exports = [
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('balance')
      .setDescription(t('查看你的錢包餘額', 'Check your wallet balance'))
      .setDMPermission(false)
      .addUserOption((o) => o.setName('user').setDescription(t('要查看的成員（預設自己）', 'Member to check (default: you)'))),
    cooldown: 3000,
    async run(interaction, client) {
      const target = interaction.options.getUser('user') || interaction.user;
      const profile = await economy.getProfile(client, interaction.guild.id, target.id);
      const cur = await currency(client, interaction.guild.id);
      const wallet = profile.wallet || 0;
      const member = interaction.guild.members.cache.get(target.id);
      const name = member ? member.displayName : target.username;
      const embed = new EmbedBuilder()
        .setColor(Colors.ECONOMY)
        .setTitle(t(`${name} 的錢包`, `${name}'s wallet`))
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: t(`${cur} 錢包`, `${cur} Wallet`), value: formatNumber(wallet), inline: true },
          { name: t('💰 總資產', '💰 Total Assets'), value: formatNumber(wallet), inline: true }
        );
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('rich')
      .setDescription(t('查看伺服器最有錢的前 10 名', 'View the top 10 richest members'))
      .setDMPermission(false),
    cooldown: 5000,
    async run(interaction, client) {
      const prefix = `${interaction.guild.id}:`;
      const entries = client.db
        .collection('economy')
        .all()
        .filter((e) => e.id.startsWith(prefix))
        .sort((a, b) => (b.wallet || 0) - (a.wallet || 0))
        .slice(0, 10);
      if (entries.length === 0) return sendError(interaction, t('目前還沒有任何經濟資料。', 'No economy data yet.'));
      const cur = await currency(client, interaction.guild.id);
      const medals = ['🥇', '🥈', '🥉'];
      const lines = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const userId = e.id.slice(prefix.length);
        const user = await client.users.fetch(userId).catch(() => null);
        const member = interaction.guild.members.cache.get(userId);
        const name = member ? member.displayName : user ? user.username : userId;
        lines.push(`${medals[i] || `**${i + 1}.**`} ${name} — ${cur} **${formatNumber(e.wallet || 0)}**`);
      }
      const embed = new EmbedBuilder()
        .setColor(Colors.ECONOMY)
        .setTitle(t('🏆 財富排行榜', '🏆 Richest Leaderboard'))
        .setDescription(lines.join('\n'));
      withFooter(embed, client, t('前 10 名', 'Top 10'));
      await interaction.reply({ embeds: [embed] });
    },
  },
];
