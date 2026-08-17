const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('clear').setDescription(t('清空播放佇列（保留目前播放）', 'Clear the queue (keep current track)')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.clear(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('清空佇列時發生錯誤，請稍後再試', 'An error occurred while clearing the queue, please try again later')).catch(() => {});
    }
  },
};
