const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const CHOICES = ['石頭', '剪刀', '布'];
const EMOJI = { 石頭: '✊', 剪刀: '✌️', 布: '✋' };
/** 出哪一手可以贏：RULES[出招] = 打敗的對象 */
const RULES = { 石頭: '剪刀', 剪刀: '布', 布: '石頭' };

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription(t('跟機器人玩剪刀石頭布', 'Play rock-paper-scissors with the bot'))
    .addStringOption((o) =>
      o
        .setName('choice')
        .setDescription(t('你的選擇', 'Your choice'))
        .setRequired(true)
        .addChoices(
          { name: t('✊ 石頭', '✊ Rock'), value: '石頭' },
          { name: t('✌️ 剪刀', '✌️ Scissors'), value: '剪刀' },
          { name: t('✋ 布', '✋ Paper'), value: '布' }
        )
    ),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const userChoice = interaction.options.getString('choice', true);
      const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];

      let result;
      if (userChoice === botChoice) result = '平手';
      else if (RULES[userChoice] === botChoice) result = '勝利';
      else result = '落敗';

      const resultText =
        result === '勝利' ? t('🎉 你贏了！', '🎉 You win!') : result === '落敗' ? t('😅 你輸了，再試一次！', '😅 You lost, try again!') : t('🤝 平手！', '🤝 It\'s a tie!');

      const embed = new EmbedBuilder()
        .setColor(result === '勝利' ? Colors.SUCCESS : result === '落敗' ? Colors.ERROR : Colors.INFO)
        .setTitle(t('✊✌️✋ 剪刀石頭布', '✊✌️✋ Rock-Paper-Scissors'))
        .setDescription(
          t(`你出了 **${EMOJI[userChoice]} ${userChoice}**`, `You played **${EMOJI[userChoice]} ${userChoice}**`) + '\n' +
            t(`機器人出了 **${EMOJI[botChoice]} ${botChoice}**`, `The bot played **${EMOJI[botChoice]} ${botChoice}**`) + '\n\n' +
            `**${resultText}**`
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('進行猜拳時發生錯誤。', 'An error occurred while playing rock-paper-scissors.'));
    }
  },
};
