const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

/** 依相容度回傳評語 */
function comment(percent) {
  if (percent >= 90) return t('💖 天作之合！你們簡直是命中注定！', '💖 A match made in heaven! You are destined!');
  if (percent >= 70) return t('😍 非常相配，快點在一起吧！', '😍 Perfect match — get together already!');
  if (percent >= 50) return t('🙂 有一定默契，但還需要多培養。', '🙂 Some chemistry, but it needs more time.');
  if (percent >= 30) return t('😅 有些火花，但可能只是朋友。', '😅 A little spark, but maybe just friends.');
  return t('💔 看起來不太合適，還是當朋友吧。', '💔 Not a great match — better stay friends.');
}

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription(t('計算兩人的相容度', 'Calculate the compatibility of two people'))
    .addUserOption((o) => o.setName('user1').setDescription(t('第一個人', 'First person')).setRequired(true))
    .addUserOption((o) => o.setName('user2').setDescription(t('第二個人（預設為自己）', 'Second person (defaults to you)'))),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const u1 = interaction.options.getUser('user1', true);
      const u2 = interaction.options.getUser('user2') || interaction.user;
      const percent = Math.floor(Math.random() * 101);
      const filled = Math.round(percent / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      const embed = new EmbedBuilder()
        .setColor(percent >= 70 ? Colors.SUCCESS : percent >= 40 ? Colors.INFO : Colors.ERROR)
        .setTitle(t('💘 相容度計算', '💘 Compatibility Check'))
        .setDescription(
          `**${u1.username}** ❤️ **${u2.username}**\n\n` +
            `**${percent}%**  ${bar}\n\n` +
            comment(percent)
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('計算相容度時發生錯誤。', 'An error occurred while calculating compatibility.'));
    }
  },
};
