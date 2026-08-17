const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('resume').setDescription(t('繼續播放已暫停的音樂', 'Resume the paused music')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.resume(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('恢復播放時發生錯誤，請稍後再試', 'An error occurred while resuming, please try again later')).catch(() => {});
    }
  },
};
