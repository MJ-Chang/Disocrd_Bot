const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { sendError, sendSuccess, info, withFooter } = require('../../utils/embeds');
const { discordTimestamp } = require('../../utils/format');
const { isAdmin } = require('../../core/permissions');
const { addWarn, getWarns, removeWarn, clearWarns, logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

const base = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description);

/** /warn — 警告成員 */
const warnCmd = {
  category: 'moderation',
  data: base('warn', t('警告成員', 'Warn a member'))
    .addUserOption((o) => o.setName('user').setDescription(t('要警告的成員', 'Member to warn')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('警告原因', 'Warn reason'))),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');

    if (target.id === interaction.user.id) return sendError(interaction, t('你不能警告自己。', "You can't warn yourself."));
    if (target.id === client.user.id) return sendError(interaction, t('你不能警告機器人。', "You can't warn the bot."));
    const member = interaction.guild.members.cache.get(target.id);
    if (member && isAdmin(member)) return sendError(interaction, t('無法警告管理員。', "Can't warn an admin."));

    const caseObj = await addWarn(client, interaction.guild.id, target.id, interaction.user.id, reason);
    const cases = await getWarns(client, interaction.guild.id, target.id);

    await logModAction(client, interaction.guild, t('警告（warn）', 'Warn'), target, interaction.member, reason);
    return sendSuccess(
      interaction,
      t(
        `已警告 **${target.tag}**，此為第 **${cases.length}** 次警告。\n案例 ID：\`${caseObj.id}\``,
        `Warned **${target.tag}**. This is warning **#${cases.length}**.\nCase ID: \`${caseObj.id}\``
      )
    );
  },
};

/** /warnings — 查看成員的警告紀錄 */
const warningsCmd = {
  category: 'moderation',
  data: base('warnings', t('查看成員的警告紀錄', 'View a member warning history'))
    .addUserOption((o) => o.setName('user').setDescription(t('要查看的成員', 'Member to check')).setRequired(true)),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const cases = await getWarns(client, interaction.guild.id, target.id);

    const embed = info(t('📋 警告紀錄', '📋 Warning History')).setDescription(
      t(`**${target.tag}** 目前有 **${cases.length}** 筆警告紀錄。`, `**${target.tag}** currently has **${cases.length}** warning(s).`)
    );
    if (cases.length === 0) {
      embed.addFields({ name: t('沒有紀錄', 'No Records'), value: t('該成員目前沒有任何警告紀錄。', 'This member has no warnings.') });
    } else {
      for (const [i, c] of cases.slice(0, 25).entries()) {
        const ts = Date.parse(c.date);
        const time = Number.isNaN(ts) ? t('未知', 'Unknown') : discordTimestamp(ts, 'f');
        const modName = c.modId ? client.users.cache.get(c.modId)?.tag || `<@${c.modId}>` : t('未知', 'Unknown');
        embed.addFields({
          name: t(`案例 #${i + 1}`, `Case #${i + 1}`),
          value: t(
            `**執行人：** ${modName}\n**原因：** ${c.reason}\n**時間：** ${time}\n**案例 ID：** \`${c.id}\``,
            `**Moderator:** ${modName}\n**Reason:** ${c.reason}\n**Time:** ${time}\n**Case ID:** \`${c.id}\``
          ),
        });
      }
    }
    withFooter(embed, client, t(`共 ${cases.length} 筆紀錄`, `${cases.length} record(s) total`));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

/** /removewarn — 移除指定警告案例 */
const removewarnCmd = {
  category: 'moderation',
  data: base('removewarn', t('移除成員的警告案例', 'Remove a member warning case'))
    .addUserOption((o) => o.setName('user').setDescription(t('要操作的成員', 'Member to manage')).setRequired(true))
    .addStringOption((o) => o.setName('caseid').setDescription(t('要移除的警告案例 ID', 'Warning case ID to remove')).setRequired(true)),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const caseId = interaction.options.getString('caseid');

    const ok = await removeWarn(client, interaction.guild.id, target.id, caseId);
    if (!ok) return sendError(interaction, t('找不到該警告案例，請確認案例 ID 正確。', 'Warning case not found. Check the case ID.'));

    await logModAction(client, interaction.guild, t('移除警告（removewarn）', 'Remove warning'), target, interaction.member, t(`案例 ID：${caseId}`, `Case ID: ${caseId}`));
    return sendSuccess(interaction, t(`已移除 **${target.tag}** 的警告案例 \`${caseId}\`。`, `Removed warning case \`${caseId}\` from **${target.tag}**.`));
  },
};

/** /clearwarns — 清除所有警告紀錄 */
const clearwarnsCmd = {
  category: 'moderation',
  data: base('clearwarns', t('清除成員的所有警告紀錄', 'Clear all warnings of a member'))
    .addUserOption((o) => o.setName('user').setDescription(t('要操作的成員', 'Member to manage')).setRequired(true)),
  modOnly: true,
  async run(interaction, client) {
    const target = interaction.options.getUser('user');
    const n = await clearWarns(client, interaction.guild.id, target.id);
    if (n === 0) return sendError(interaction, t('該成員沒有任何警告紀錄。', 'This member has no warnings.'));

    await logModAction(client, interaction.guild, t('清除警告（clearwarns）', 'Clear warnings'), target, interaction.member, t(`共清除 ${n} 筆`, `Cleared ${n} record(s)`));
    return sendSuccess(interaction, t(`已清除 **${target.tag}** 的 **${n}** 筆警告紀錄。`, `Cleared **${n}** warning(s) for **${target.tag}**.`));
  },
};

module.exports = [warnCmd, warningsCmd, removewarnCmd, clearwarnsCmd];
