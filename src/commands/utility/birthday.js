const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const birthdays = require('../../features/birthdays');
const { requireAdmin } = require('../../core/permissions');
const { Colors } = require('../../utils/constants');
const { withFooter, sendError, sendSuccess } = require('../../utils/embeds');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription(t('生日管理', 'Birthday management'))
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription(t('設定你的生日', 'Set your birthday'))
        .addIntegerOption((o) => o.setName('month').setDescription(t('月份（1-12）', 'Month (1-12)')).setMinValue(1).setMaxValue(12).setRequired(true))
        .addIntegerOption((o) => o.setName('day').setDescription(t('日期（1-31）', 'Day (1-31)')).setMinValue(1).setMaxValue(31).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('remove').setDescription(t('移除你的生日', 'Remove your birthday')))
    .addSubcommand((sub) => sub.setName('list').setDescription(t('查看伺服器的生日列表', 'View the server birthday list')))
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription(t('設定生日公告頻道（管理員）', 'Set birthday channel (admin)'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('公告頻道', 'Announcement channel')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription(t('設定生日身分組（管理員）', 'Set birthday role (admin)'))
        .addRoleOption((o) => o.setName('role').setDescription(t('身分組', 'Role')).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === 'set') {
      const month = interaction.options.getInteger('month');
      const day = interaction.options.getInteger('day');
      if (day > DAYS_IN_MONTH[month - 1]) return sendError(interaction, t('該日期無效，請檢查月份的天數！', 'Invalid date, check the days in that month!'));
      await birthdays.set(client, guildId, userId, month, day);
      return sendSuccess(interaction, t(`已設定你的生日為 **${month} 月 ${day} 日**！`, `Your birthday is set to **${month}/${day}**!`));
    }

    if (sub === 'remove') {
      const ok = await birthdays.remove(client, guildId, userId);
      if (!ok) return sendError(interaction, t('你還沒有設定生日。', "You haven't set a birthday yet."));
      return sendSuccess(interaction, t('已移除你的生日！', 'Your birthday was removed!'));
    }

    if (sub === 'list') {
      const entries = await birthdays.list(client, guildId);
      if (entries.length === 0) return sendError(interaction, t('目前還沒有任何生日資料。', 'No birthday data yet.'));
      const lines = entries.map((e) => t(`**${e.month} 月 ${e.day} 日** — <@${e.userId}>`, `**${e.month}/${e.day}** — <@${e.userId}>`));
      const embed = new EmbedBuilder()
        .setColor(Colors.MAIN)
        .setTitle(t('🎂 生日列表', '🎂 Birthday List'))
        .setDescription(lines.join('\n'));
      withFooter(embed, client, t(`共 ${entries.length} 筆`, `${entries.length} entries`));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'channel' || sub === 'role') {
      if (!(await requireAdmin(interaction))) return;
      if (sub === 'channel') {
        const channel = interaction.options.getChannel('channel');
        await client.settings.set(guildId, 'birthdays.channel', channel.id);
        return sendSuccess(interaction, t(`已設定生日公告頻道為 <#${channel.id}>！`, `Birthday announcement channel set to <#${channel.id}>!`));
      }
      const role = interaction.options.getRole('role');
      await client.settings.set(guildId, 'birthdays.role', role.id);
      return sendSuccess(interaction, t(`已設定生日身分組為 ${role}！`, `Birthday role set to ${role}!`));
    }

    return sendError(interaction, t('未知的子指令。', 'Unknown subcommand.'));
  },
};
