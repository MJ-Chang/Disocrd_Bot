const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireAdmin } = require('../../core/permissions');
const suggestions = require('../../features/suggestions');
const { logger } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'suggestions',
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription(t('建議系統', 'Suggestion system'))
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription(t('設定建議頻道', 'Set up suggestion channel'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('建議要發布到的頻道', 'Channel for suggestions')).setRequired(true))
    )
    .addSubcommand((s) => s.setName('disable').setDescription(t('停用建議系統', 'Disable suggestion system')))
    .addSubcommand((s) =>
      s
        .setName('send')
        .setDescription(t('發布一則建議', 'Post a suggestion'))
        .addStringOption((o) => o.setName('text').setDescription(t('建議內容', 'Suggestion content')).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    try {
      if (sub === 'setup') {
        if (!(await requireAdmin(interaction))) return;
        const channel = interaction.options.getChannel('channel');
        if (!channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) {
          await sendError(interaction, t('建議頻道必須是文字頻道。', 'The suggestion channel must be a text channel.'));
          return;
        }
        await client.settings.set(guild.id, 'suggestions.channel', channel.id);
        await client.settings.set(guild.id, 'suggestions.enabled', true);
        await sendSuccess(interaction, t(`建議系統已啟用，建議頻道設為 ${channel}。`, `Suggestion system enabled, channel set to ${channel}.`));
        return;
      }

      if (sub === 'disable') {
        if (!(await requireAdmin(interaction))) return;
        await client.settings.set(guild.id, 'suggestions.enabled', false);
        await sendSuccess(interaction, t('建議系統已停用。', 'Suggestion system disabled.'));
        return;
      }

      if (sub === 'send') {
        const text = interaction.options.getString('text');
        const s = await client.settings.get(guild.id);
        if (!s.suggestions.enabled || !s.suggestions.channel) {
          await sendError(
            interaction,
            t('建議系統尚未啟用，請管理員先使用 `/suggest setup` 設定建議頻道。', 'Suggestion system not enabled; an admin must run `/suggest setup` first.')
          );
          return;
        }
        const channel = guild.channels.cache.get(s.suggestions.channel);
        if (!channel) {
          await sendError(interaction, t('找不到建議頻道，請管理員重新設定。', 'Suggestion channel not found; please ask an admin to set it up again.'));
          return;
        }
        const message = await suggestions.post(client, guild, channel, interaction.user, text);
        if (message) await sendSuccess(interaction, t(`建議已發布：${channel}`, `Suggestion posted: ${channel}`));
        return;
      }
    } catch (e) {
      logger.error('suggest', `執行 suggest 指令失敗：${e.stack || e.message}`);
      await sendError(interaction, t('執行 suggest 指令時發生錯誤，請稍後再試。', 'An error occurred while running the suggest command, please try again later.'));
    }
  },
};
