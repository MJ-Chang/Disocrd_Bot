const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { discordTimestamp, formatNumber } = require('../../utils/format');
const { t } = require('../../utils/i18n');

const VERIFY_LABELS = {
  None: t('無', 'None'),
  Low: t('低', 'Low'),
  Medium: t('中', 'Medium'),
  High: t('高', 'High'),
  VeryHigh: t('很高', 'Very High'),
};

const TIER_LABELS = { 0: t('無', 'None'), 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder().setName('serverinfo').setDescription(t('查看伺服器的詳細資訊', 'View server details')),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const guild = interaction.guild;

      let owner = null;
      try {
        owner = await guild.fetchOwner();
      } catch (e) {
        owner = null;
      }

      // 成員數（總 / 人類 / 機器人）
      let humans = null;
      let bots = null;
      try {
        const members = await guild.members.fetch();
        humans = members.filter((m) => !m.user.bot).size;
        bots = members.filter((m) => m.user.bot).size;
      } catch (e) {
        /* 無法完整拉取成員時，退回只顯示總數 */
      }
      const total = guild.memberCount;

      const channels = guild.channels.cache;
      const textCount = channels.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceCount = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
      const categoryCount = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🏠 伺服器資訊', '🏠 Server Info'))
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: t('名稱', 'Name'), value: guild.name, inline: true },
          { name: 'ID', value: guild.id, inline: true },
          { name: t('擁有者', 'Owner'), value: owner ? owner.user.tag : t('（無法取得）', 'Unavailable'), inline: true },
          { name: t('成員總數', 'Total members'), value: formatNumber(total), inline: true },
          { name: t('人類', 'Humans'), value: humans !== null ? formatNumber(humans) : '—', inline: true },
          { name: t('機器人', 'Bots'), value: bots !== null ? formatNumber(bots) : '—', inline: true },
          { name: t('文字頻道', 'Text channels'), value: formatNumber(textCount), inline: true },
          { name: t('語音頻道', 'Voice channels'), value: formatNumber(voiceCount), inline: true },
          { name: t('分類', 'Categories'), value: formatNumber(categoryCount), inline: true },
          { name: t('身分組數量', 'Roles'), value: formatNumber(guild.roles.cache.size), inline: true },
          {
            name: 'Boost',
            value: t(
              `⭐ ${formatNumber(guild.premiumSubscriptionCount || 0)} 個（${TIER_LABELS[guild.premiumTier] || t('未知', 'Unknown')}）`,
              `⭐ ${formatNumber(guild.premiumSubscriptionCount || 0)} (${TIER_LABELS[guild.premiumTier] || t('未知', 'Unknown')})`
            ),
            inline: true,
          },
          { name: t('建立時間', 'Created'), value: discordTimestamp(guild.createdTimestamp, 'R'), inline: true },
          { name: t('驗證等級', 'Verification level'), value: VERIFY_LABELS[guild.verificationLevel] || t('未知', 'Unknown'), inline: true }
        )
        .setTimestamp();
      withFooter(embed, client);

      const payload = { embeds: [embed] };
      const icon = guild.iconURL({ size: 1024 });
      if (icon) {
        payload.components = [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t('查看伺服器圖示', 'View server icon')).setStyle(ButtonStyle.Link).setURL(icon)
          ),
        ];
      }
      await interaction.reply(payload);
    } catch (e) {
      return sendError(interaction, t('查詢伺服器資訊時發生錯誤。', 'An error occurred while fetching server info.'));
    }
  },
};
