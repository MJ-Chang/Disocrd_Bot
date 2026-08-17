const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription(t('從佇列移除指定曲目', 'Remove a track from the queue'))
    .addIntegerOption((o) =>
      o.setName('index').setDescription(t('曲目編號（1 為第一首）', 'Track number (1 = first)')).setRequired(true).setMinValue(1)
    ),
  async run(interaction, client) {
    const music = require('../../features/music');
    const index = interaction.options.getInteger('index', true);
    try {
      await music.removeAt(client, interaction, index);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('移除曲目時發生錯誤，請稍後再試', 'An error occurred while removing the track, please try again later')).catch(() => {});
    }
  },
};
