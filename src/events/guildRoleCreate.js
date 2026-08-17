const { info } = require('../utils/embeds');

module.exports = {
  name: 'guildRoleCreate',
  async run(client, role) {
    try {
      if (!role.guild) return;

      const s = await client.settings.get(role.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.roleCreate) return;

      const embed = info('🎭 身分組已建立').addFields(
        { name: '身分組', value: `<@&${role.id}>` },
        { name: '顏色', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
        { name: '單獨顯示', value: role.hoist ? '是' : '否', inline: true },
        { name: '可被提及', value: role.mentionable ? '是' : '否', inline: true }
      );
      await require('../features/logging').sendLog(client, role.guild, embed, 'roleCreate');
    } catch (e) {
      /* 靜默 */
    }
  },
};
