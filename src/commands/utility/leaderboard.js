const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const leveling = require('../../features/leveling');
const { Colors } = require('../../utils/constants');
const { formatNumber } = require('../../utils/format');
const { withFooter, sendError } = require('../../utils/embeds');

module.exports = {
  category: 'leveling',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(t('查看伺服器等級排行榜前 10 名', 'View the top 10 level leaderboard'))
    .setDMPermission(false),
  cooldown: 5000,
  async run(interaction, client) {
    const prefix = `${interaction.guild.id}:`;
    const entries = client.db
      .collection('levels')
      .all()
      .filter((e) => e.id.startsWith(prefix))
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10);
    if (entries.length === 0) return sendError(interaction, t('目前還沒有任何等級資料。', 'No level data yet.'));

    const rows = await Promise.all(
      entries.map(async (e) => {
        const userId = e.id.slice(prefix.length);
        const { level } = await leveling.getRank(client, interaction.guild.id, userId);
        return { userId, level, xp: e.xp || 0 };
      })
    );

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const member = interaction.guild.members.cache.get(r.userId);
      const user = client.users.cache.get(r.userId);
      const name = member ? member.displayName : user ? user.username : r.userId;
      return t(`${medals[i] || `**${i + 1}.**`} ${name} — Lv. **${r.level}**（${formatNumber(r.xp)} XP）`, `${medals[i] || `**${i + 1}.**`} ${name} — Lv. **${r.level}** (${formatNumber(r.xp)} XP)`);
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.LEVELING)
      .setTitle(t('🏆 等級排行榜', '🏆 Level Leaderboard'))
      .setDescription(lines.join('\n'));
    withFooter(embed, client, t('前 10 名', 'Top 10'));
    await interaction.reply({ embeds: [embed] });
  },
};
