const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription(t('修改成員暱稱', 'Change a member nickname'))
    .addUserOption((o) => o.setName('user').setDescription(t('要修改暱稱的成員', 'Member to rename')).setRequired(true))
    .addStringOption((o) => o.setName('nickname').setDescription(t('新暱稱（留空則重設為預設）', 'New nickname (empty to reset)'))),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能修改自己的暱稱（請直接使用個人設定）。', "You can't change your own nickname (use your user settings)."));
    if (nickname && nickname.length > 32) return sendError(interaction, t('暱稱最多 **32** 個字元。', 'Nicknames can be at most **32** characters.'));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageNicknames, t('❌ 機器人缺少「管理暱稱」權限。', "❌ Missing 'Manage Nicknames' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法修改該成員的暱稱（對方是管理員或角色階層過高）。', "You can't change this member's nickname (admin or higher role)."));
    }

    try {
      await member.setNickname(nickname || null, t('管理指令 nick', 'Moderation command: nick'));
    } catch (e) {
      return sendError(interaction, t('修改暱稱失敗，請確認機器人權限與角色階層。', 'Failed to change nickname. Check bot permissions and role hierarchy.'));
    }

    await logModAction(
      client,
      interaction.guild,
      t('修改暱稱（nick）', 'Change nickname'),
      target,
      interaction.member,
      nickname ? t(`新暱稱：${nickname}`, `New nickname: ${nickname}`) : t('重設暱稱', 'Reset nickname')
    );
    return sendSuccess(
      interaction,
      nickname ? t(`已將 **${target.tag}** 的暱稱設為 **${nickname}**。`, `Set **${target.tag}**'s nickname to **${nickname}**.`) : t(`已重設 **${target.tag}** 的暱稱。`, `Reset **${target.tag}**'s nickname.`)
    );
  },
};
