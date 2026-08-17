const { info } = require('../utils/embeds');

const CHANNEL_TYPE_LABELS = {
  0: '文字頻道',
  2: '語音頻道',
  4: '分類',
  5: '公告頻道',
  13: '舞台頻道',
  15: '討論串',
  16: '論壇頻道',
};

module.exports = {
  name: 'channelCreate',
  async run(client, channel) {
    try {
      if (!channel.guild) return; // 忽略 DM

      const s = await client.settings.get(channel.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.channelCreate) return;

      const embed = info('📁 頻道已建立').addFields(
        { name: '頻道', value: `<#${channel.id}>` },
        { name: '類型', value: CHANNEL_TYPE_LABELS[channel.type] || String(channel.type), inline: true },
        { name: '分類', value: channel.parent?.name || '無', inline: true }
      );
      await require('../features/logging').sendLog(client, channel.guild, embed, 'channelCreate');
    } catch (e) {
      /* 靜默 */
    }
  },
};
