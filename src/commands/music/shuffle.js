const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('shuffle').setDescription(t('洗牌播放佇列', 'Shuffle the playback queue')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.shuffle(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('洗牌佇列時發生錯誤，請稍後再試', 'An error occurred while shuffling, please try again later')).catch(() => {});
    }
  },
};
