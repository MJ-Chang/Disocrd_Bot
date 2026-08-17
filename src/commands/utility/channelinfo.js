const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { discordTimestamp, formatNumber } = require('../../utils/format');
const { t } = require('../../utils/i18n');

const TYPE_LABELS = {
  [ChannelType.GuildText]: t('📝 文字頻道', '📝 Text channel'),
  [ChannelType.GuildVoice]: t('🔊 語音頻道', '🔊 Voice channel'),
  [ChannelType.GuildCategory]: t('📁 分類', '📁 Category'),
  [ChannelType.GuildAnnouncement]: t('📢 公告頻道', '📢 Announcement channel'),
  [ChannelType.GuildStageVoice]: t('🎤 舞台頻道', '🎤 Stage channel'),
  [ChannelType.GuildForum]: t('💬 論壇頻道', '💬 Forum channel'),
};

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription(t('查看頻道的詳細資訊', 'View channel details'))
    .addChannelOption((o) => o.setName('channel').setDescription(t('要查看的頻道（預設為目前頻道）', 'Channel to view (default: current)'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel) {
        return sendError(interaction, t('找不到該頻道。', 'Channel not found.'));
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t(`📌 頻道資訊：${channel.name}`, `📌 Channel Info: ${channel.name}`))
        .addFields(
          { name: t('名稱', 'Name'), value: channel.name, inline: true },
          { name: 'ID', value: channel.id, inline: true },
          { name: t('類型', 'Type'), value: TYPE_LABELS[channel.type] || t('其他', 'Other'), inline: true },
          { name: t('分類', 'Category'), value: channel.parent ? channel.parent.name : t('（無）', 'None'), inline: true },
          { name: t('主題', 'Topic'), value: channel.topic ? String(channel.topic).slice(0, 100) : t('（無）', 'None'), inline: false },
          {
            name: t('慢速模式', 'Slowmode'),
            value: channel.rateLimitPerUser ? t(`${formatNumber(channel.rateLimitPerUser)} 秒`, `${formatNumber(channel.rateLimitPerUser)}s`) : t('關閉', 'Off'),
            inline: true,
          },
          { name: 'NSFW', value: channel.nsfw ? t('是 🔞', 'Yes 🔞') : t('否', 'No'), inline: true },
          { name: t('建立時間', 'Created'), value: discordTimestamp(channel.createdTimestamp, 'R'), inline: true }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢頻道資訊時發生錯誤。', 'An error occurred while fetching channel info.'));
    }
  },
};
