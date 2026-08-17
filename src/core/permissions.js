const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { t } = require('../utils/i18n');

/** 是否為管理員（Administrator 或 ManageGuild） */
function isAdmin(member) {
  if (!member?.permissions) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

/** 是否為管理人員（擁有任一管理權限） */
function isModerator(member) {
  if (!member?.permissions) return false;
  return member.permissions.any([
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers,
  ]);
}

/** 是否擁有指定權限 */
function hasPerm(member, perm) {
  return member?.permissions?.has(perm) ?? false;
}

/** 檢查互動是否發生在伺服器內，否則回覆錯誤並回傳 false */
async function requireGuild(interaction) {
  if (interaction.inGuild()) return true;
  await interaction.reply({ content: t('❌ 此指令只能在伺服器中使用。', '❌ This command can only be used in a server.'), flags: MessageFlags.Ephemeral });
  return false;
}

/** 檢查是否為管理員，否則回覆錯誤並回傳 false */
async function requireAdmin(interaction) {
  if (!(await requireGuild(interaction))) return false;
  if (isAdmin(interaction.member)) return true;
  await interaction.reply({ content: t('❌ 你沒有權限使用此指令（需要「管理伺服器」權限）。', "❌ You don't have permission to use this (requires 'Manage Server')."), flags: MessageFlags.Ephemeral });
  return false;
}

/** 檢查是否為管理人員，否則回覆錯誤並回傳 false */
async function requireMod(interaction) {
  if (!(await requireGuild(interaction))) return false;
  if (isModerator(interaction.member)) return true;
  await interaction.reply({ content: t('❌ 你沒有權限使用此指令（需要管理權限）。', "❌ You don't have permission to use this command."), flags: MessageFlags.Ephemeral });
  return false;
}

/** 檢查機器人是否擁有指定權限 */
async function requireBotPerm(interaction, perm, message) {
  const me = interaction.guild?.members?.me;
  if (me && me.permissions.has(perm)) return true;
  await interaction.reply({
    content: message || t('❌ 機器人缺少執行此操作所需的權限。', '❌ The bot is missing the required permission for this action.'),
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

/** 機器人是否可管理目標成員（角色階層檢查） */
function canModerate(botMember, targetMember) {
  if (!botMember || !targetMember) return false;
  return botMember.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
}

/** 可否對目標成員執行管理操作（權限 + 階層 + 非管理員保護） */
function canManageMember(interaction, target) {
  const bot = interaction.guild.members.me;
  if (!canModerate(bot, target)) return false;
  if (!canModerate(interaction.member, target)) return false;
  if (isAdmin(target)) return false;
  return true;
}

module.exports = {
  isAdmin,
  isModerator,
  hasPerm,
  requireGuild,
  requireAdmin,
  requireMod,
  requireBotPerm,
  canModerate,
  canManageMember,
};
