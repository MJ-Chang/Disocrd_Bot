const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const ANSWERS = [
  // 肯定
  '是的，絕對如此。',
  '毫無疑問，答案是肯定的。',
  '可以確定的是，會這樣發展。',
  '依我看來，答案就是「是」。',
  '非常有可能。',
  '跡象顯示，是肯定的。',
  '放心，結果會如你所願。',
  // 模糊
  '現在還無法確定，請再問一次。',
  '先別急，答案尚未明朗。',
  '專注一點，再問我一次吧。',
  '這是個好問題，但我無法回答。',
  '可能吧，但也可能不是。',
  '天機不可洩漏，我只能說「再看看」。',
  // 否定
  '答案是否定的。',
  '恐怕不是這樣。',
  '不要抱太大期望，結果會讓你失望。',
  '依我看來，可能性很低。',
  '跡象顯示，答案是否定的。',
  '別想了，這條路行不通。',
  '我的直覺告訴我：不會。',
  '很遺憾，結果會不如預期。',
];

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription(t('詢問魔法 8 球一個問題', 'Ask the magic 8-ball a question'))
    .addStringOption((o) => o.setName('question').setDescription(t('要詢問的問題', 'The question to ask')).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const question = interaction.options.getString('question', true);
      const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
      const embed = new EmbedBuilder()
        .setColor(Colors.PURPLE)
        .setTitle(t('🔮 魔法 8 球', '🔮 Magic 8-Ball'))
        .addFields(
          { name: t('你的問題', 'Your question'), value: question.slice(0, 1024), inline: false },
          { name: t('答案', 'Answer'), value: answer, inline: false }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('詢問 8 球時發生錯誤。', 'An error occurred while asking the 8-ball.'));
    }
  },
};
