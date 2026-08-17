const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription(t('大量刪除訊息', 'Bulk delete messages'))
    .addIntegerOption((o) =>
      o.setName('amount').setDescription(t('要刪除的訊息數量（1-100）', 'Number of messages to delete (1-100)')).setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .addUserOption((o) => o.setName('user').setDescription(t('只刪除特定成員的訊息', 'Only delete messages from this member'))),
  modOnly: true,
  async run(interaction, client) {
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageMessages, t('❌ 機器人缺少「管理訊息」權限。', "❌ Missing 'Manage Messages' permission.")))) return;

    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getUser('user') || null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const fetched = await interaction.channel.messages.fetch({ limit: Math.min(amount, 100) });
      let toDelete = [...fetched.values()].filter((m) => !m.pinned);
      if (target) toDelete = toDelete.filter((m) => m.author.id === target.id);

      if (toDelete.length === 0) {
        return interaction.editReply({ content: t('❌ 沒有符合條件的訊息可刪除。', '❌ No matching messages to delete.') });
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      const count = deleted.size || toDelete.length;
      await interaction.editReply({ content: t(`✅ 已刪除 ${count} 則訊息。`, `✅ Deleted ${count} message(s).`) });

      // 3 秒後自動刪除回覆（失敗靜默）
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 3000);
    } catch (e) {
      return sendError(interaction, t('刪除訊息失敗，請確認訊息皆在 14 天內且機器人有「管理訊息」權限。', 'Failed to delete messages. Make sure they are within 14 days and the bot has Manage Messages permission.'));
    }
  },
};
