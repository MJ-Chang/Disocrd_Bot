const { info } = require('../utils/embeds');

module.exports = {
  name: 'guildRoleDelete',
  async run(client, role) {
    try {
      if (!role.guild) return;

      const s = await client.settings.get(role.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.roleDelete) return;

      const embed = info('🎭 身分組已刪除').addFields(
        { name: '身分組', value: role.name || '（未知）' },
        { name: 'ID', value: `\`${role.id}\`` }
      );
      await require('../features/logging').sendLog(client, role.guild, embed, 'roleDelete');
    } catch (e) {
      /* 靜默 */
    }
  },
};
