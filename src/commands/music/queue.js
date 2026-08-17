const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('queue').setDescription(t('查看播放佇列', 'View the playback queue')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.queueList(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('讀取播放佇列時發生錯誤，請稍後再試', 'An error occurred while reading the queue, please try again later')).catch(() => {});
    }
  },
};
