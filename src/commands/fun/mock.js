const { SlashCommandBuilder } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('mock')
    .setDescription(t('用嘲諷式大小寫重複你的文字', 'Repeat your text in mocking alternating caps'))
    .addStringOption((o) => o.setName('text').setDescription(t('要嘲諷的文字', 'Text to mock')).setRequired(true).setMaxLength(1000)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const text = interaction.options.getString('text', true);
      let mock = '';
      for (const ch of text) {
        mock += Math.random() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
      }
      await interaction.reply({ content: mock || t('（空白）', '(empty)'), allowedMentions: { parse: [] } });
    } catch (e) {
      return sendError(interaction, t('執行 mock 指令時發生錯誤。', 'An error occurred while running the mock command.'));
    }
  },
};
