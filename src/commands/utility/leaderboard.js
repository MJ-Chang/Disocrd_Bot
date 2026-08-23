const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const leveling = require('../../features/leveling');
const { Colors } = require('../../utils/constants');
const { formatNumber } = require('../../utils/format');
const { withFooter, sendError } = require('../../utils/embeds');

const PAGE_SIZE = 10;

module.exports = {
  category: 'leveling',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(t('查看伺服器等級排行榜（分頁）', 'View the level leaderboard (paginated)'))
    .addIntegerOption((o) => o.setName('page').setDescription(t('第幾頁（每頁 10 名，預設 1）', 'Page number (10 per page, default 1)')).setMinValue(1))
    .setDMPermission(false),
  cooldown: 5000,
  async run(interaction, client) {
    const prefix = `${interaction.guild.id}:`;
    const page = interaction.options.getInteger('page') || 1;

    const all = client.db
      .collection('levels')
      .all()
      .filter((e) => e.id.startsWith(prefix))
      .sort((a, b) => (b.xp || 0) - (a.xp || 0));

    if (all.length === 0) return sendError(interaction, t('目前還沒有任何等級資料。', 'No level data yet.'));

    const totalPages = Math.ceil(all.length / PAGE_SIZE);
    if (page > totalPages) {
      return sendError(interaction, t(`最多只有 ${totalPages} 頁。`, `There are only ${totalPages} page(s).`));
    }

    const entries = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const rows = await Promise.all(
      entries.map(async (e) => {
        const userId = e.id.slice(prefix.length);
        const { level } = await leveling.getRank(client, interaction.guild.id, userId);
        return { userId, level, xp: e.xp || 0 };
      })
    );

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const rank = (page - 1) * PAGE_SIZE + i + 1;
      const member = interaction.guild.members.cache.get(r.userId);
      const user = client.users.cache.get(r.userId);
      const name = member ? member.displayName : user ? user.username : r.userId;
      const prefixMark = medals[i] || `**${rank}.**`;
      return t(
        `${prefixMark} ${name} — Lv. **${r.level}**（${formatNumber(r.xp)} XP）`,
        `${prefixMark} ${name} — Lv. **${r.level}** (${formatNumber(r.xp)} XP)`
      );
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.LEVELING)
      .setTitle(t('🏆 等級排行榜', '🏆 Level Leaderboard'))
      .setDescription(lines.join('\n'));
    withFooter(embed, client, t(`第 ${page} / ${totalPages} 頁 ｜ 共 ${all.length} 人（/leaderboard page:2 翻頁）`, `Page ${page}/${totalPages} ｜ ${all.length} total (use /leaderboard page:2)`));
    await interaction.reply({ embeds: [embed] });
  },
};
