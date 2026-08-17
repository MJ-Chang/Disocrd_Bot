const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'music',
  data: new SlashCommandBuilder().setName('join').setDescription(t('讓機器人加入你的語音頻道', 'Make the bot join your voice channel')),
  async run(interaction, client) {
    const music = require('../../features/music');
    try {
      await music.join(client, interaction);
    } catch (e) {
      const { sendError } = require('../../utils/embeds');
      await sendError(interaction, t('加入語音頻道時發生錯誤，請稍後再試', 'An error occurred while joining the voice channel, please try again later')).catch(() => {});
    }
  },
};
