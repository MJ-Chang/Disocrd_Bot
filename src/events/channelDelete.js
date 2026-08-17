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
  name: 'channelDelete',
  async run(client, channel) {
    try {
      if (!channel.guild) return; // 忽略 DM

      const s = await client.settings.get(channel.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.channelDelete) return;

      // 嘗試從稽核日誌取得執行人（type 12 = ChannelDelete）
      let executorId = null;
      try {
        const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 });
        executorId = audit.entries.first()?.executor?.id || null;
      } catch (e) {
        /* 忽略 */
      }
      // 機器人動作忽略
      if (executorId === client.user.id) return;

      const embed = info('🗑️ 頻道已刪除').addFields(
        { name: '頻道', value: `#${channel.name || '（未知）'}` },
        { name: '類型', value: CHANNEL_TYPE_LABELS[channel.type] || String(channel.type), inline: true },
        { name: '分類', value: channel.parent?.name || '無', inline: true }
      );
      await require('../features/logging').sendLog(client, channel.guild, embed, 'channelDelete');

      // 反突襲檢查
      if (executorId) {
        await require('../features/automod').checkRaid(client, channel.guild, executorId, 'channelDelete');
      }
    } catch (e) {
      /* 靜默 */
    }
  },
};
