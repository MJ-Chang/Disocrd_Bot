const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('reverse')
    .setDescription(t('反轉一段文字', 'Reverse a piece of text'))
    .addStringOption((o) => o.setName('text').setDescription(t('要反轉的文字', 'Text to reverse')).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const text = interaction.options.getString('text', true);
      // 用展開運算子以正確處理 emoji / 代理對
      const reversed = [...text].reverse().join('');
      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('🔁 文字反轉', '🔁 Text Reverse'))
        .addFields(
          { name: t('原文', 'Original'), value: text.slice(0, 1024) || t('（空白）', '(empty)'), inline: false },
          { name: t('反轉後', 'Reversed'), value: reversed.slice(0, 1024) || t('（空白）', '(empty)'), inline: false }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('反轉文字時發生錯誤。', 'An error occurred while reversing the text.'));
    }
  },
};
