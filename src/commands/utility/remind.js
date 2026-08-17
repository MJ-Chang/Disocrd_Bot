const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const reminders = require('../../features/reminders');
const { Colors } = require('../../utils/constants');
const { parseDuration, formatDuration, discordTimestamp } = require('../../utils/format');
const { withFooter, sendError, sendSuccess } = require('../../utils/embeds');

/** setTimeout 上限（約 24.8 天） */
const MAX_DELAY = 2147483647;

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription(t('設定提醒', 'Set a reminder'))
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('me')
        .setDescription(t('在指定時間後提醒你', 'Remind you after a duration'))
        .addStringOption((o) => o.setName('duration').setDescription(t('例如 1h30m、30m、1d2h', 'e.g. 1h30m, 30m, 1d2h')).setRequired(true))
        .addStringOption((o) => o.setName('text').setDescription(t('提醒內容', 'Reminder text')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription(t('查看你的提醒列表', 'View your reminders')))
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription(t('刪除一個提醒', 'Delete a reminder'))
        .addStringOption((o) => o.setName('id').setDescription(t('提醒 ID', 'Reminder ID')).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'me') {
      const durationStr = interaction.options.getString('duration');
      const text = interaction.options.getString('text');
      const ms = parseDuration(durationStr);
      if (!ms) return sendError(interaction, t('無法解析時間格式，請使用例如 `1h30m`、`30m`、`1d`。', 'Invalid time format. Use e.g. `1h30m`, `30m`, `1d`.'));
      if (ms > MAX_DELAY) return sendError(interaction, t('提醒時間過長（最多約 24 天）。', 'Reminder too long (max ~24 days).'));
      const at = Date.now() + ms;
      const entry = await reminders.schedule(client, {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        text,
        at,
      });
      return sendSuccess(
        interaction,
        t(`已設定提醒！\n⏰ ${formatDuration(ms)} 後（${discordTimestamp(at, 'f')}）\n📝 ${text}\n🆔 \`${entry.id}\``, `Reminder set!\n⏰ In ${formatDuration(ms)} (${discordTimestamp(at, 'f')})\n📝 ${text}\n🆔 \`${entry.id}\``)
      );
    }

    if (sub === 'list') {
      const entries = await reminders.list(client, interaction.user.id);
      if (entries.length === 0) return sendError(interaction, t('你目前沒有待執行的提醒。', "You don't have any pending reminders."));
      const lines = entries.slice(0, 10).map((e) => `🆔 \`${e.id}\`\n📝 ${e.text}\n⏰ ${discordTimestamp(e.at, 'R')}`);
      if (entries.length > 10) lines.push(t(`…還有 ${entries.length - 10} 筆`, `…and ${entries.length - 10} more`));
      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t('⏰ 我的提醒', '⏰ My Reminders'))
        .setDescription(lines.join('\n\n'));
      withFooter(embed, client, t(`共 ${entries.length} 筆`, `${entries.length} entries`));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const ok = await reminders.removeById(client, id);
      if (!ok) return sendError(interaction, t('找不到該提醒（可能已執行或已刪除）。', 'Reminder not found (it may have fired or been deleted).'));
      return sendSuccess(interaction, t('已刪除該提醒！', 'Reminder deleted!'));
    }

    return sendError(interaction, t('未知的子指令。', 'Unknown subcommand.'));
  },
};
