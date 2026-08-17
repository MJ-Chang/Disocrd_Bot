const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription(t('設定循環模式', 'Set the loop mode'))
    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription(t('循環模式', 'Loop mode'))
        .setRequired(true)
        .addChoices(
          { name: t('關閉循環', 'Loop off'), value: 'off' },
          { name: t('循環整個佇列', 'Loop queue'), value: 'queue' },
          { name: t('單曲循環', 'Loop one'), value: 'one' }
        )
    ),
  async run(interaction, client) {
    const music = require('../../features/music');
    const mode = interaction.options.getString('mode', true);
    try {
      await music.loop(client, interaction, mode);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('設定循環模式時發生錯誤，請稍後再試', 'An error occurred while setting the loop mode, please try again later')).catch(() => {});
    }
  },
};
