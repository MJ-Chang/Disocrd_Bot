const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError } = require('../../utils/embeds');
const { discordTimestamp, formatNumber } = require('../../utils/format');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription(t('查看身分組的詳細資訊', 'View role details'))
    .addRoleOption((o) => o.setName('role').setDescription(t('要查看的身分組', 'Role to view')).setRequired(true)),
  cooldown: 3000,
  async run(interaction, client) {
    try {
      const role = interaction.options.getRole('role');
      if (!role) {
        return sendError(interaction, t('找不到該身分組。', 'Role not found.'));
      }

      const perms = role.permissions.toArray();
      const permNames = perms
        .slice(0, 10)
        .map((p) => `\`${p}\``)
        .join('、');

      const embed = new EmbedBuilder()
        .setColor(role.color || Colors.INFO)
        .setTitle(t(`🎭 身分組資訊：${role.name}`, `🎭 Role Info: ${role.name}`))
        .addFields(
          { name: t('名稱', 'Name'), value: role.name, inline: true },
          { name: 'ID', value: role.id, inline: true },
          {
            name: t('顏色', 'Color'),
            value: role.color ? `#${role.color.toString(16).padStart(6, '0').toUpperCase()}` : t('（無）', 'None'),
            inline: true,
          },
          { name: t('顯示位置', 'Position'), value: formatNumber(role.position), inline: true },
          { name: t('可被提及', 'Mentionable'), value: role.mentionable ? t('是 ✅', 'Yes ✅') : t('否 ❌', 'No ❌'), inline: true },
          {
            name: t('管理員權限', 'Admin permission'),
            value: role.permissions.has(PermissionFlagsBits.Administrator) ? t('是 ✅', 'Yes ✅') : t('否 ❌', 'No ❌'),
            inline: true,
          },
          { name: t('成員數量', 'Members'), value: formatNumber(role.members.size), inline: true },
          { name: t('建立時間', 'Created'), value: discordTimestamp(role.createdTimestamp, 'R'), inline: true },
          {
            name: t(`權限（共 ${formatNumber(perms.length)} 個，顯示前 10）`, `Permissions (${formatNumber(perms.length)} total, showing first 10)`),
            value: permNames || t('（無任何權限）', 'No permissions'),
            inline: false,
          }
        )
        .setTimestamp();
      withFooter(embed, client);
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      return sendError(interaction, t('查詢身分組資訊時發生錯誤。', 'An error occurred while fetching role info.'));
    }
  },
};
