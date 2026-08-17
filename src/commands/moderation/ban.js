const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription(t('封鎖成員', 'Ban a member'))
    .addUserOption((o) => o.setName('user').setDescription(t('要封鎖的成員', 'Member to ban')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('封鎖原因', 'Ban reason')))
    .addIntegerOption((o) =>
      o.setName('delete_days').setDescription(t('刪除過去幾天的訊息（0-7）', 'Delete messages from past days (0-7)')).setMinValue(0).setMaxValue(7)
    ),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能封鎖自己。', "You can't ban yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能封鎖機器人。', "You can't ban the bot."));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.BanMembers, t('❌ 機器人缺少「封鎖成員」權限。', "❌ Missing 'Ban Members' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (member && !canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法封鎖該成員（對方是管理員或角色階層過高）。', "You can't ban this member (admin or higher role)."));
    }

    const options = { reason, deleteMessageSeconds: deleteDays * 86400 };
    try {
      if (member) await member.ban(options);
      else await interaction.guild.members.ban(target.id, options);
    } catch (e) {
      return sendError(interaction, t('封鎖失敗，請確認機器人權限與目標狀態。', 'Ban failed. Check bot permissions and target status.'));
    }

    try {
      await target.send(
        t(
          `你在 **${interaction.guild.name}** 已被封鎖。\n原因：${reason}\n若你認為這是誤判，請聯絡伺服器管理員。`,
          `You have been banned from **${interaction.guild.name}**.\nReason: ${reason}\nIf you believe this is a mistake, please contact a server administrator.`
        )
      );
    } catch (e) {
      /* DM 失敗或關閉，忽略 */
    }

    await logModAction(client, interaction.guild, t('封鎖（ban）', 'Ban'), target, interaction.member, reason);
    return sendSuccess(
      interaction,
      t(
        `已封鎖 **${target.tag}**。\n原因：${reason}${deleteDays > 0 ? `\n已刪除過去 ${deleteDays} 天的訊息。` : ''}`,
        `Banned **${target.tag}**.\nReason: ${reason}${deleteDays > 0 ? `\nDeleted messages from the past ${deleteDays} day(s).` : ''}`
      )
    );
  },
};
