const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('nowplaying').setDescription(t('查看目前播放的音樂', 'Show the currently playing track')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.nowplaying(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('讀取目前播放資訊時發生錯誤，請稍後再試', 'An error occurred while reading playback info, please try again later')).catch(() => {});
    }
  },
};
