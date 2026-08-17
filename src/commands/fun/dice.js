const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription(t('擲骰子', 'Roll a dice'))
    .addIntegerOption((o) =>
      o.setName('sides').setDescription(t('骰子面數（2-100，預設 6）', 'Number of sides (2-100, default 6)')).setMinValue(2).setMaxValue(100)
    ),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const sides = interaction.options.getInteger('sides') || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      const die = sides === 6 ? FACES[result - 1] : '';
      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🎲 擲骰子', '🎲 Dice Roll'))
        .setDescription(t(`擲出了一顆 **${sides}** 面骰：**${die} ${result}**`, `Rolled a **${sides}**-sided die: **${die} ${result}**`))
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('擲骰子時發生錯誤。', 'An error occurred while rolling the dice.'));
    }
  },
};
