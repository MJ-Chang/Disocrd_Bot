const { SlashCommandBuilder } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription(t('讓機器人重複你說的話', 'Make the bot repeat what you say'))
    .addStringOption((o) => o.setName('text').setDescription(t('要重複的文字', 'Text to repeat')).setRequired(true).setMaxLength(2000)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const text = interaction.options.getString('text', true);
      // 禁止觸發提及，避免濫用 @everyone 等
      await interaction.reply({ content: text, allowedMentions: { parse: [] } });
    } catch (e) {
      return sendError(interaction, t('執行 say 指令時發生錯誤。', 'An error occurred while running the say command.'));
    }
  },
};
