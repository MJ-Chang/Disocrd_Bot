const { info } = require('../utils/embeds');

module.exports = {
  name: 'messageDelete',
  async run(client, message) {
    try {
      if (!message.guild) return;
      // partial 訊息先 fetch，失敗則跳過
      if (message.partial) {
        try {
          await message.fetch();
        } catch (e) {
          return;
        }
      }
      // 機器人動作忽略
      if (!message.author || message.author.bot) return;

      const s = await client.settings.get(message.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.messageDelete) return;

      const embed = info('🗑️ 訊息已刪除').addFields(
        { name: '作者', value: `${message.author.tag}（\`${message.author.id}\`）` },
        { name: '頻道', value: `<#${message.channelId}>` },
        { name: '內容', value: (message.content || '（無文字內容）').slice(0, 500) || '（無文字內容）' }
      );
      await require('../features/logging').sendLog(client, message.guild, embed, 'messageDelete');
    } catch (e) {
      /* 靜默 */
    }
  },
};
