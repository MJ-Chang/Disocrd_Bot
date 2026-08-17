const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm, canManageMember } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { parseDuration, formatDuration } = require('../../utils/format');
const { t } = require('../../utils/i18n');

const MAX_TIMEOUT_MS = 28 * 86400000; // Discord 上限：28 天

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription(t('限制成員發言（timeout）', 'Timeout a member'))
    .addUserOption((o) => o.setName('user').setDescription(t('要限制的成員', 'Member to timeout')).setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription(t('持續時間，例如 10m、1h、2h30m', 'Duration, e.g. 10m, 1h, 2h30m')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('原因', 'Reason'))),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能對自己設定 timeout。', "You can't timeout yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能對機器人設定 timeout。', "You can't timeout the bot."));

    const ms = parseDuration(durationStr);
    if (!ms || ms <= 0) {
      return sendError(interaction, t('無法解析時間格式，請使用如 `10m`、`1h`、`2h30m`。', 'Invalid duration format. Use e.g. `10m`, `1h`, `2h30m`.'));
    }
    if (ms > MAX_TIMEOUT_MS) return sendError(interaction, t('timeout 最長只能設定 **28 天**。', 'Timeout can be at most **28 days**.'));
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ModerateMembers, t('❌ 機器人缺少「管理成員」權限。', "❌ Missing 'Moderate Members' permission.")))) return;

    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return sendError(interaction, t('該成員不在伺服器中。', 'That member is not in the server.'));
    if (!canManageMember(interaction, member)) {
      return sendError(interaction, t('你無法對該成員設定 timeout（對方是管理員或角色階層過高）。', "You can't timeout this member (admin or higher role)."));
    }

    try {
      await member.timeout(ms, reason);
    } catch (e) {
      return sendError(interaction, t('設定 timeout 失敗，請確認機器人權限與角色階層。', 'Timeout failed. Check bot permissions and role hierarchy.'));
    }

    try {
      await target.send(
        t(
          `你在 **${interaction.guild.name}** 已被設定 timeout **${formatDuration(ms)}**。\n原因：${reason}`,
          `You have been timed out in **${interaction.guild.name}** for **${formatDuration(ms)}**.\nReason: ${reason}`
        )
      );
    } catch (e) {
      /* DM 失敗或關閉，忽略 */
    }

    await logModAction(client, interaction.guild, t('Timeout（限制發言）', 'Timeout'), target, interaction.member, t(`${reason}（持續 ${formatDuration(ms)}）`, `${reason} (duration: ${formatDuration(ms)})`));
    return sendSuccess(interaction, t(`已對 **${target.tag}** 設定 timeout **${formatDuration(ms)}**。\n原因：${reason}`, `Timed out **${target.tag}** for **${formatDuration(ms)}**.\nReason: ${reason}`));
  },
};
