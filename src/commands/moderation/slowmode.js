const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription(t('設定頻道慢速模式', 'Set channel slowmode'))
    .addIntegerOption((o) =>
      o.setName('seconds').setDescription(t('訊息間隔秒數（0-21600）', 'Seconds between messages (0-21600)')).setMinValue(0).setMaxValue(21600).setRequired(true)
    )
    .addChannelOption((o) => o.setName('channel').setDescription(t('要設定的頻道（預設為目前頻道）', 'Channel to set (default: current)'))),
  modOnly: true,
  async run(interaction, client) {
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageChannels, t('❌ 機器人缺少「管理頻道」權限。', "❌ Missing 'Manage Channels' permission.")))) return;

    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel.isTextBased()) return sendError(interaction, t('慢速模式只能設定在文字類頻道上。', 'Slowmode can only be set on text channels.'));

    try {
      await channel.setRateLimitPerUser(seconds, t('慢速模式設定', 'Slowmode setting'));
    } catch (e) {
      return sendError(interaction, t('設定慢速模式失敗，請確認機器人權限。', 'Failed to set slowmode. Check bot permissions.'));
    }

    await logModAction(
      client,
      interaction.guild,
      t('慢速模式（slowmode）', 'Slowmode'),
      { id: channel.id, name: `#${channel.name}` },
      interaction.member,
      t(`設定為 ${seconds} 秒`, `Set to ${seconds} second(s)`)
    );
    return sendSuccess(interaction, t(`已將 **${channel.name}** 的慢速模式設為 **${seconds} 秒**。`, `Slowmode for **${channel.name}** set to **${seconds} second(s)**.`));
  },
};
