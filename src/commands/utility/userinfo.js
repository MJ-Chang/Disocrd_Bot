const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { discordTimestamp, formatNumber } = require('../../utils/format');
const { t } = require('../../utils/i18n');

/** 顯示用戶名稱（相容新式 / 舊式名稱系統） */
function displayTag(user) {
  return user.discriminator && user.discriminator !== '0'
    ? `${user.username}#${user.discriminator}`
    : user.globalName || user.username;
}

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription(t('查看用戶的詳細資訊', 'View user details'))
    .addUserOption((o) => o.setName('user').setDescription(t('要查看的用戶（預設為自己）', 'User to view (default: you)'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const target = interaction.options.getUser('user') || interaction.user;
      const member =
        interaction.guild.members.cache.get(target.id) ||
        (await interaction.guild.members.fetch(target.id).catch(() => null));
      if (!member) {
        return sendError(interaction, t('找不到該用戶的成員資料。', 'Member data not found for this user.'));
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('👤 用戶資訊', '👤 User Info'))
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: t('名稱', 'Name'), value: target.username, inline: true },
          { name: t('標籤', 'Tag'), value: displayTag(target), inline: true },
          { name: 'ID', value: target.id, inline: true },
          {
            name: t('加入伺服器', 'Joined server'),
            value: member.joinedTimestamp ? discordTimestamp(member.joinedTimestamp, 'R') : t('（未知）', 'Unknown'),
            inline: true,
          },
          { name: t('帳號建立', 'Account created'), value: discordTimestamp(target.createdTimestamp, 'R'), inline: true },
          { name: t('機器人', 'Bot'), value: target.bot ? t('是 🤖', 'Yes 🤖') : t('否', 'No'), inline: true },
          { name: t('最高身分組', 'Highest role'), value: member.roles.highest ? `${member.roles.highest}` : t('（無）', 'None'), inline: true },
          { name: t('身分組數量', 'Roles'), value: formatNumber(Math.max(0, member.roles.cache.size - 1)), inline: true },
          {
            name: t('Boost 狀態', 'Boost status'),
            value: member.premiumSince
              ? t(`🚀 已 Boost（${discordTimestamp(member.premiumSinceTimestamp, 'R')}）`, `🚀 Boosting (${discordTimestamp(member.premiumSinceTimestamp, 'R')})`)
              : t('未 Boost', 'Not boosting'),
            inline: true,
          }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢用戶資訊時發生錯誤。', 'An error occurred while fetching user info.'));
    }
  },
};
