const { info } = require('../utils/embeds');

module.exports = {
  name: 'messageUpdate',
  async run(client, oldMessage, newMessage) {
    try {
      if (!oldMessage.guild || !newMessage.guild) return;
      if (oldMessage.partial) {
        try {
          await oldMessage.fetch();
        } catch (e) {
          return;
        }
      }
      if (newMessage.partial) {
        try {
          await newMessage.fetch();
        } catch (e) {
          return;
        }
      }
      // 機器人動作忽略
      if (!oldMessage.author || oldMessage.author.bot) return;

      const oldContent = oldMessage.content;
      const newContent = newMessage.content;
      // 僅在內容改變時記錄
      if (oldContent == null || newContent == null || oldContent === newContent) return;

      const s = await client.settings.get(oldMessage.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.messageEdit) return;

      const embed = info('✏️ 訊息已編輯').addFields(
        { name: '作者', value: `${oldMessage.author.tag}（\`${oldMessage.author.id}\`）` },
        { name: '頻道', value: `<#${oldMessage.channelId}>` },
        { name: '修改前', value: oldContent.slice(0, 200) || '（空白）' },
        { name: '修改後', value: newContent.slice(0, 200) || '（空白）' }
      );
      await require('../features/logging').sendLog(client, oldMessage.guild, embed, 'messageEdit');
    } catch (e) {
      /* 靜默 */
    }
  },
};
