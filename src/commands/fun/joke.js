const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const JOKES = [
  '為什麼程式設計師分不清萬聖節和聖誕節？因為 OCT 31 == DEC 25。',
  '為什麼魚不喜歡電腦？因為它怕被「網路釣魚」（phishing）。',
  '有一天，0 對 8 說：「你綁個腰帶就以為自己很酷？」',
  '為什麼電腦老是生病？因為它一直「中毒」！',
  '有一天，番茄和蛋吵架，番茄說：「你滾！」蛋就真的滾了，變成了蛋花湯。',
  '什麼動物最會寫程式？螃蟹，因為它會「除錯」（debug）——一直「剪」錯誤。',
  '為什麼手機不敢洗澡？因為它怕「進水」然後「關機」！',
  '老闆對員工說：「從明天開始，你就是公司的『棟樑』。」員工感動地問：「真的嗎？」老闆說：「對，負責撐住所有爛攤子。」',
  '為什麼月亮不會胖？因為它每天晚上都在「減肥」——繞著地球跑步。',
  '什麼水果最會考試？香蕉，因為它永遠「剝」得開（all in）。',
  '有一天，麵包和饅頭比賽跑步，麵包贏了，因為饅頭「發」晚了。',
  '為什麼程式設計師下班後不想跟人講話？因為他的「記憶體」滿了。',
  '什麼茶最受歡迎？「烏龍」茶，因為大家都愛看烏龍事件。',
  '為什麼咖啡喜歡工作？因為它每天都要「提神」。',
  '有一天，0 跟 1 吵架，1 說：「你什麼都不是！」0 哭了，1 只好說：「好啦，你在我後面就變 10 了。」',
  '為什麼鴨子很會賺錢？因為它會「呱呱叫」（估價）！',
  '數學老師問小明：「1+1 等於多少？」小明說：「不知道，回家問爸媽。」隔天小明說：「我爸在看電視說『別吵』，我媽在廚房說『買』。」老師問：「那答案呢？」小明：「別吵、買。」',
];

module.exports = {
  category: 'fun',
  data: new SlashCommandBuilder().setName('joke').setDescription(t('隨機說一個笑話', 'Tell a random joke')),
  cooldown: 5000,
  async run(interaction, client) {
    try {
      const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
      const embed = new EmbedBuilder()
        .setColor(Colors.WARN)
        .setTitle(t('😂 笑話時間', '😂 Joke Time'))
        .setDescription(joke)
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('說笑話時發生錯誤。', 'An error occurred while telling the joke.'));
    }
  },
};
