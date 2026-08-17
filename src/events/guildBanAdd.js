const { info } = require('../utils/embeds');

module.exports = {
  name: 'guildBanAdd',
  async run(client, ban) {
    try {
      if (!ban.guild) return;

      const s = await client.settings.get(ban.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.ban) return;

      // 嘗試從稽核日誌取得執行人（type 22 = BanAdd）
      let executorId = null;
      try {
        const audit = await ban.guild.fetchAuditLogs({ limit: 1, type: 22 });
        executorId = audit.entries.first()?.executor?.id || null;
      } catch (e) {
        /* 忽略 */
      }
      // 機器人動作忽略
      if (executorId === client.user.id) return;

      const fields = [
        { name: '成員', value: `${ban.user.tag}（\`${ban.user.id}\`）` },
        { name: '原因', value: ban.reason || '（未提供）' },
      ];
      if (executorId) fields.push({ name: '執行人', value: `<@${executorId}>` });

      const embed = info('🔨 成員被封鎖').addFields(fields);
      await require('../features/logging').sendLog(client, ban.guild, embed, 'ban');

      // 反突襲檢查
      if (executorId) {
        await require('../features/automod').checkRaid(client, ban.guild, executorId, 'ban');
      }
    } catch (e) {
      /* 靜默 */
    }
  },
};
