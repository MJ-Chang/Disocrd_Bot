const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription(t('播放音樂或將音樂加入佇列', 'Play music or add it to the queue'))
    .addStringOption((o) => o.setName('query').setDescription(t('音樂名稱或網址', 'Song name or URL')).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    const music = require('../../features/music');
    const query = interaction.options.getString('query', true);
    try {
      await music.play(client, interaction, query);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('播放時發生錯誤，請稍後再試', 'An error occurred while playing, please try again later')).catch(() => {});
    }
  },
};
