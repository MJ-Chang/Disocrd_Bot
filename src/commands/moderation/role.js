const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription(t('管理成員身分組', 'Manage member roles'))
    .addSubcommand((sc) =>
      sc
        .setName('add')
        .setDescription(t('為成員新增身分組', 'Add a role to a member'))
        .addUserOption((o) => o.setName('user').setDescription(t('要操作的成員', 'Member to manage')).setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription(t('身分組', 'Role')).setRequired(true))
    )
    .addSubcommand((sc) =>
      sc
        .setName('remove')
        .setDescription(t('移除成員的身分組', 'Remove a role from a member'))
        .addUserOption((o) => o.setName('user').setDescription(t('要操作的成員', 'Member to manage')).setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription(t('身分組', 'Role')).setRequired(true))
    ),
  modOnly: true,
  async run(interaction, client) {
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageRoles, t('❌ 機器人缺少「管理身分組」權限。', "❌ Missing 'Manage Roles' permission.")))) return;

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (role.id === interaction.guild.id) return sendError(interaction, t('無法操作 @everyone 身分組。', "You can't manage the @everyone role."));
    if (role.managed) return sendError(interaction, t('此身分組由系統或整合管理，無法手動操作。', 'This role is managed by the system or an integration.'));

    const botHighest = interaction.guild.members.me.roles.highest;
    if (botHighest.comparePositionTo(role) <= 0) {
      return sendError(interaction, t('機器人的最高身分組階層低於該身分組，無法操作。', "The bot's highest role is below that role, cannot manage it."));
    }

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法操作該成員的身分組（對方是管理員或角色階層過高）。', "You can't manage this member's roles (admin or higher role)."));
    }

    const has = member.roles.cache.has(role.id);
    if (sub === 'add') {
      if (has) return sendError(interaction, t(`**${target.tag}** 已擁有身分組 **${role.name}**。`, `**${target.tag}** already has the role **${role.name}**.`));
      try {
        await member.roles.add(role, t('管理指令 role add', 'Moderation command: role add'));
      } catch (e) {
        return sendError(interaction, t('新增身分組失敗，請確認角色階層與權限。', 'Failed to add role. Check role hierarchy and permissions.'));
      }
    } else {
      if (!has) return sendError(interaction, t(`**${target.tag}** 沒有身分組 **${role.name}**。`, `**${target.tag}** doesn't have the role **${role.name}**.`));
      try {
        await member.roles.remove(role, t('管理指令 role remove', 'Moderation command: role remove'));
      } catch (e) {
        return sendError(interaction, t('移除身分組失敗，請確認角色階層與權限。', 'Failed to remove role. Check role hierarchy and permissions.'));
      }
    }

    await logModAction(
      client,
      interaction.guild,
      sub === 'add' ? t('新增身分組（role add）', 'Add role (role add)') : t('移除身分組（role remove）', 'Remove role (role remove)'),
      target,
      interaction.member,
      t(`身分組：${role.name}`, `Role: ${role.name}`)
    );
    return sendSuccess(
      interaction,
      sub === 'add'
        ? t(`已為 **${target.tag}** 新增身分組 **${role.name}**。`, `Added role **${role.name}** to **${target.tag}**.`)
        : t(`已從 **${target.tag}** 移除身分組 **${role.name}**。`, `Removed role **${role.name}** from **${target.tag}**.`)
    );
  },
};
