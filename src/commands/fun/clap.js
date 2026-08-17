const { SlashCommandBuilder } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('clap')
    .setDescription(t('用鼓掌表情分隔文字', 'Separate words with clapping emoji'))
    .addStringOption((o) => o.setName('text').setDescription(t('要鼓掌的文字', 'Text to clap')).setRequired(true).setMaxLength(1000)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const text = interaction.options.getString('text', true).trim();
      const clapped = text.replace(/\s+/g, ' 👏 ');
      await interaction.reply({ content: `👏 ${clapped} 👏`, allowedMentions: { parse: [] } });
    } catch (e) {
      return sendError(interaction, t('執行 clap 指令時發生錯誤。', 'An error occurred while running the clap command.'));
    }
  },
};
