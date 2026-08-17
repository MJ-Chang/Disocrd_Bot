const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('skip').setDescription(t('跳過目前播放的音樂', 'Skip the currently playing track')),
  cooldown: 3000,
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.skip(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('跳過音樂時發生錯誤，請稍後再試', 'An error occurred while skipping, please try again later')).catch(() => {});
    }
  },
};
