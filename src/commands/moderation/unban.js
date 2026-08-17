const { SlashCommandBuilder } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription(t('解除成員封鎖', 'Unban a member'))
    .addStringOption((o) => o.setName('user_id').setDescription(t('要解除封鎖的使用者 ID', 'User ID to unban')).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription(t('解除封鎖原因', 'Unban reason'))),
  modOnly: true,
  async run(interaction, client) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || t('（未提供原因）', '(no reason provided)');

    const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!banEntry) return sendError(interaction, t('找不到該使用者的封鎖紀錄。', 'No ban record found for that user.'));

    try {
      await interaction.guild.bans.remove(userId, reason);
    } catch (e) {
      return sendError(interaction, t('解除封鎖失敗，請確認機器人權限。', 'Unban failed. Check bot permissions.'));
    }

    const user = banEntry.user;
    await logModAction(client, interaction.guild, t('解除封鎖（unban）', 'Unban'), user, interaction.member, reason);
    return sendSuccess(interaction, t(`已解除 **${user.tag}** 的封鎖。\n原因：${reason}`, `Unbanned **${user.tag}**.\nReason: ${reason}`));
  },
};
