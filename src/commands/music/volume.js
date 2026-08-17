const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription(t('調整播放音量', 'Adjust the playback volume'))
    .addIntegerOption((o) =>
      o.setName('level').setDescription(t('音量（0-100）', 'Volume (0-100)')).setRequired(true).setMinValue(0).setMaxValue(100)
    ),
  async run(interaction, client) {
    const music = require('../../features/music');
    const level = interaction.options.getInteger('level', true);
    try {
      await music.volume(client, interaction, level);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('調整音量時發生錯誤，請稍後再試', 'An error occurred while adjusting the volume, please try again later')).catch(() => {});
    }
  },
};
