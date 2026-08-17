const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('pause').setDescription(t('暫停目前播放的音樂', 'Pause the currently playing track')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.pause(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('暫停播放時發生錯誤，請稍後再試', 'An error occurred while pausing, please try again later')).catch(() => {});
    }
  },
};
