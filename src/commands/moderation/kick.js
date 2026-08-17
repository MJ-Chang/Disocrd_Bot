const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription(t('踢出成員', 'Kick a member'))
    .addUserOption((o) => o.setName('user').setDescription(t('要踢出的成員', 'Member to kick')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('踢出原因', 'Kick reason'))),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能踢出自己。', "You can't kick yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能踢出機器人。', "You can't kick the bot."));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.KickMembers, t('❌ 機器人缺少「踢出成員」權限。', "❌ Missing 'Kick Members' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法踢出該成員（對方是管理員或角色階層過高）。', "You can't kick this member (admin or higher role)."));
    }

    try {
      await member.kick(reason);
    } catch (e) {
      return sendError(interaction, t('踢出失敗，請確認機器人權限與角色階層。', 'Kick failed. Check bot permissions and role hierarchy.'));
    }

    try {
      await target.send(
        t(
          `你在 **${interaction.guild.name}** 已被踢出。\n原因：${reason}`,
          `You have been kicked from **${interaction.guild.name}**.\nReason: ${reason}`
        )
      );
    } catch (e) {
      /* DM 失敗或關閉，忽略 */
    }

    await logModAction(client, interaction.guild, t('踢出（kick）', 'Kick'), target, interaction.member, reason);
    return sendSuccess(interaction, t(`已踢出 **${target.tag}**。\n原因：${reason}`, `Kicked **${target.tag}**.\nReason: ${reason}`));
  },
};
