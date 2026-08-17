const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('stop').setDescription(t('停止播放並離開語音頻道', 'Stop playback and leave the voice channel')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.stop(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('停止播放時發生錯誤，請稍後再試', 'An error occurred while stopping, please try again later')).catch(() => {});
    }
  },
};
