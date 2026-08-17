const { info } = require('../utils/embeds');

module.exports = {
  name: 'guildMemberUpdate',
  async run(client, oldMember, newMember) {
    try {
      if (!newMember.guild || newMember.user?.bot) return; // 機器人動作忽略

      const s = await client.settings.get(newMember.guild.id);
      const logs = (s && s.logs) || {};
      if (!logs.enabled || !logs.events || !logs.events.memberUpdate) return;

      const oldRoles = oldMember.roles?.cache || newMember.roles.cache;
      const newRoles = newMember.roles.cache;
      const guildId = newMember.guild.id;
      const fields = [];

      const added = newRoles.filter((r) => !oldRoles.has(r.id) && r.id !== guildId);
      if (added.size > 0) {
        fields.push({
          name: '➕ 新增身分組',
          value:
            added
              .first(5)
              .map((r) => `\`${r.name}\``)
              .join('、') + (added.size > 5 ? ` 等 ${added.size} 個` : ''),
        });
      }

      const removed = oldRoles.filter((r) => !newRoles.has(r.id) && r.id !== guildId);
      if (removed.size > 0) {
        fields.push({
          name: '➖ 移除身分組',
          value:
            removed
              .first(5)
              .map((r) => `\`${r.name}\``)
              .join('、') + (removed.size > 5 ? ` 等 ${removed.size} 個` : ''),
        });
      }

      if (oldMember.nickname !== newMember.nickname) {
        fields.push({
          name: '✏️ 暱稱變更',
          value: `${oldMember.nickname ? `\`${oldMember.nickname}\`` : '（無暱稱）'} → ${
            newMember.nickname ? `\`${newMember.nickname}\`` : '（無暱稱）'
          }`,
        });
      }

      if (fields.length === 0) return;

      const embed = info('👤 成員資料更新')
        .setDescription(`${newMember.displayName}（\`${newMember.id}\`）的資料有變更`)
        .addFields(fields);
      await require('../features/logging').sendLog(client, newMember.guild, embed, 'memberUpdate');
    } catch (e) {
      /* 靜默 */
    }
  },
};
