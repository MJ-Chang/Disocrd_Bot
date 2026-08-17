const { info } = require('../utils/embeds');

module.exports = {
  name: 'guildBanRemove',
  async run(client, ban) {
    try {
      if (!ban.guild) return;

      const s = await client.settings.get(ban.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.unban) return;

      const embed = info('🔓 已解除封鎖').addFields(
        { name: '成員', value: `${ban.user.tag}（\`${ban.user.id}\`）` },
        { name: '原因', value: ban.reason || '（未提供）' }
      );
      await require('../features/logging').sendLog(client, ban.guild, embed, 'unban');
    } catch (e) {
      /* 靜默 */
    }
  },
};
