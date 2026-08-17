const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription(t('軟封鎖（封鎖後立即解除，刪除過去訊息）', 'Soft ban (ban then unban, delete messages)'))
    .addUserOption((o) => o.setName('user').setDescription(t('要軟封鎖的成員', 'Member to soft ban')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('軟封鎖原因', 'Soft ban reason')))
    .addIntegerOption((o) =>
      o.setName('delete_days').setDescription(t('刪除過去幾天的訊息（0-7）', 'Delete messages from past days (0-7)')).setMinValue(0).setMaxValue(7)
    ),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');
    const deleteDays = interaction.options.getInteger('delete_days') ?? 1;

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能軟封鎖自己。', "You can't soft ban yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能軟封鎖機器人。', "You can't soft ban the bot."));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.BanMembers, t('❌ 機器人缺少「封鎖成員」權限。', "❌ Missing 'Ban Members' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法軟封鎖該成員（對方是管理員或角色階層過高）。', "You can't soft ban this member (admin or higher role)."));
    }

    try {
      await member.ban({ reason, deleteMessageSeconds: deleteDays * 86400 });
      await interaction.guild.bans.remove(target.id, t('軟封鎖（softban）', 'Soft ban (softban)'));
    } catch (e) {
      return sendError(interaction, t('軟封鎖失敗，請確認機器人權限與角色階層。', 'Soft ban failed. Check bot permissions and role hierarchy.'));
    }

    try {
      await target.send(
        t(
          `你在 **${interaction.guild.name}** 已被軟封鎖（踢出並刪除過去訊息）。\n原因：${reason}`,
          `You have been soft banned from **${interaction.guild.name}** (kicked and past messages deleted).\nReason: ${reason}`
        )
      );
    } catch (e) {
      /* DM 失敗或關閉，忽略 */
    }

    await logModAction(client, interaction.guild, t('軟封鎖（softban）', 'Soft ban'), target, interaction.member, reason);
    return sendSuccess(
      interaction,
      t(
        `已軟封鎖 **${target.tag}**（封鎖後立即解除，並刪除過去 ${deleteDays} 天的訊息）。\n原因：${reason}`,
        `Soft banned **${target.tag}** (banned then unbanned, deleted messages from the past ${deleteDays} day(s)).\nReason: ${reason}`
      )
    );
  },
};
