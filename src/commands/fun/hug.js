const { SlashCommandBuilder } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('hug')
    .setDescription(t('抱抱一個人', 'Hug someone'))
    .addUserOption((o) => o.setName('user').setDescription(t('要抱抱的人', 'Person to hug')).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const target = interaction.options.getUser('user', true);
      await interaction.reply({ content: t(`${interaction.user} 抱了 ${target} 🤗`, `${interaction.user} hugged ${target} 🤗`) });
    } catch (e) {
      return sendError(interaction, t('執行 hug 指令時發生錯誤。', 'An error occurred while running the hug command.'));
    }
  },
};
