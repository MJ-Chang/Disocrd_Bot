const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const ROASTS = [
  '你的想法就像你的頭髮一樣，越來越少。',
  '跟你說話像是在跟 Wi-Fi 玩捉迷藏——永遠連不上重點。',
  '你的智商要是能跟你的自信一樣高就好了。',
  '你這種人，連時間管理大師都救不了你。',
  '你以為你是主角，其實只是背景音樂。',
  '你的存在感，比 404 錯誤頁面還低。',
  '跟你比起來，阿呆都算天才了。',
  '你的腦子是不是忘記更新了？',
  '你講話的時候，連鏡子都想轉頭。',
  '你不是胖，是「能量儲存裝置」比較大。',
  '你的幽默感要是能跟你講話的次數成正比就好了。',
  '跟你辯論，還不如去跟牆壁聊天。',
  '你的人生就像你的瀏覽器，滿滿的都是分頁，但沒一個是重點。',
  '你連自己的問題都解決不了，還想當別人的導師？',
  '你的夢想很大，但你的行動力跟蝸牛比賽都輸。',
  '如果你的努力跟你的藉口一樣多，你早就成功了。',
  '你唯一贏過的比賽，是讓別人無言以對。',
];

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription(t('吐槽一個人（善意的玩笑）', 'Roast someone (all in good fun)'))
    .addUserOption((o) => o.setName('user').setDescription(t('要吐槽的人（預設為自己）', 'Person to roast (defaults to you)'))),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const target = interaction.options.getUser('user') || interaction.user;
      const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle(t(`🔥 吐槽時間：${target.username}`, `🔥 Roast Time: ${target.username}`))
        .setDescription(t(`${target}，${roast}`, `${target}, ${roast}`))
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('執行 roast 指令時發生錯誤。', 'An error occurred while running the roast command.'));
    }
  },
};
