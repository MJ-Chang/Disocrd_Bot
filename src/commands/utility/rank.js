const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const leveling = require('../../features/leveling');
const { Colors } = require('../../utils/constants');
const { formatNumber } = require('../../utils/format');
const { withFooter } = require('../../utils/embeds');

/** 進度條（10 格） */
function progressBar(progress, size = 10) {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

module.exports = {
  category: 'leveling',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription(t('查看等級與經驗', 'Check level and XP'))
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription(t('要查看的成員（預設自己）', 'Member to check (default: you)'))),
  cooldown: 3000,
  async run(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    const { xp, level, nextLevelXp, progress } = await leveling.getRank(client, interaction.guild.id, target.id);
    const member = interaction.guild.members.cache.get(target.id);
    const name = member ? member.displayName : target.username;
    const bar = progressBar(progress);
    const percent = Math.round(progress * 100);
    const remaining = Math.max(0, nextLevelXp - xp);
    const embed = new EmbedBuilder()
      .setColor(Colors.LEVELING)
      .setTitle(t(`📈 ${name} 的等級`, `📈 ${name}'s Level`))
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: t('等級', 'Level'), value: `**Lv. ${level}**`, inline: true },
        { name: t('總經驗', 'Total XP'), value: formatNumber(xp), inline: true },
        { name: t('下一級所需', 'Next level XP'), value: formatNumber(nextLevelXp), inline: true },
        { name: t('進度', 'Progress'), value: `${bar} ${percent}%` },
        { name: t('距離下一級', 'To Next Level'), value: t(`還差 ${formatNumber(remaining)} XP`, `${formatNumber(remaining)} XP to go`) }
      );
    withFooter(embed, client);
    await interaction.reply({ embeds: [embed] });
  },
};
