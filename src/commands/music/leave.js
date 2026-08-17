const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('leave').setDescription(t('離開語音頻道並清空佇列', 'Leave the voice channel and clear the queue')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.leave(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('離開語音頻道時發生錯誤，請稍後再試', 'An error occurred while leaving the voice channel, please try again later')).catch(() => {});
    }
  },
};
