const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription(t('解除成員的 timeout', 'Remove a member timeout'))
    .addUserOption((o) => o.setName('user').setDescription(t('要解除限制的成員', 'Member to untimeout')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('原因', 'Reason'))),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能對自己操作。', "You can't do that to yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能對機器人操作。', "You can't do that to the bot."));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ModerateMembers, t('❌ 機器人缺少「管理成員」權限。', "❌ Missing 'Moderate Members' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法操作該成員（對方是管理員或角色階層過高）。', "You can't manage this member (admin or higher role)."));
    }

    try {
      await member.timeout(null, reason);
    } catch (e) {
      return sendError(interaction, t('解除 timeout 失敗，請確認機器人權限與角色階層。', 'Failed to remove timeout. Check bot permissions and role hierarchy.'));
    }

    await logModAction(client, interaction.guild, t('解除 Timeout（untimeout）', 'Remove timeout'), target, interaction.member, reason);
    return sendSuccess(interaction, t(`已解除 **${target.tag}** 的 timeout。`, `Removed timeout from **${target.tag}**.`));
  },
};
