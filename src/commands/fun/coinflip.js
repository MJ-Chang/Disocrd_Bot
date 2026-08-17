const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

// 此檔案註冊的指令名為 /flip（避免與經濟模組的 /coinflip 名稱衝突）
module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('flip')
    .setDescription(t('擲硬幣看正反面', 'Flip a coin'))
    .addStringOption((o) =>
      o
        .setName('choice')
        .setDescription(t('你的選擇（正面 / 反面）', 'Your pick (heads / tails)'))
        .addChoices(
          { name: t('正面', 'Heads'), value: '正面' },
          { name: t('反面', 'Tails'), value: '反面' }
        )
    ),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const choice = interaction.options.getString('choice');
      const result = Math.random() < 0.5 ? '正面' : '反面';
      const win = choice ? choice === result : null;

      const embed = new EmbedBuilder()
        .setColor(win === true ? Colors.SUCCESS : win === false ? Colors.ERROR : Colors.INFO)
        .setTitle(t('🪙 擲硬幣', '🪙 Coin Flip'))
        .setDescription(
          t(`結果：**${result}**${result === '正面' ? ' 🦅' : ' 👑'}\n`, `Result: **${result}**${result === '正面' ? ' 🦅' : ' 👑'}\n`) +
            (choice
              ? win
                ? t('🎉 你猜對了！', '🎉 You guessed right!')
                : t('😅 你猜錯了。', '😅 You guessed wrong.')
              : t('你沒有猜測，下次可以選「正面」或「反面」！', 'You didn\'t guess — pick "Heads" or "Tails" next time!'))
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('擲硬幣時發生錯誤。', 'An error occurred while flipping the coin.'));
    }
  },
};
