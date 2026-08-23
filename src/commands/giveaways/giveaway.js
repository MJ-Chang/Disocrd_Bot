const { MessageFlags, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/constants');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { parseDuration, discordTimestamp } = require('../../utils/format');
const { requireAdmin, requireMod } = require('../../core/permissions');
const giveaways = require('../../features/giveaways');
const { logger } = require('../../utils/logger');
const { t } = require('../../utils/i18n');

/** 依 message_id（或目前頻道最近一場未結束的抽獎）解析抽獎 */
function resolveGiveaway(client, interaction, messageId) {
  const col = client.db.collection('giveaways');
  if (messageId) {
    const g = col.get(messageId);
    return g && g.guildId === interaction.guild.id ? g : null;
  }
  const channel = interaction.channel;
  if (!channel) return null;
  const list = col
    .filter((x) => x.guildId === interaction.guild.id && x.channelId === channel.id && !x.ended)
    .sort((a, b) => (b.endsAt || 0) - (a.endsAt || 0));
  return list[0] || null;
}

/** 依 message_id（或目前頻道最近一場抽獎，含已結束）解析抽獎（供參加者名單用） */
function resolveGiveawayAny(client, interaction, messageId) {
  const col = client.db.collection('giveaways');
  if (messageId) {
    const g = col.get(messageId);
    return g && g.guildId === interaction.guild.id ? g : null;
  }
  const channel = interaction.channel;
  if (!channel) return null;
  const list = col
    .filter((x) => x.guildId === interaction.guild.id && x.channelId === channel.id)
    .sort((a, b) => (b.endsAt || 0) - (a.endsAt || 0));
  return list[0] || null;
}

module.exports = {
  category: 'giveaways',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription(t('抽獎系統', 'Giveaway system'))
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription(t('開始一場抽獎', 'Start a giveaway'))
        .addStringOption((o) => o.setName('prize').setDescription(t('獎品名稱（單一獎品用）', 'Prize name (single prize)')).setRequired(true))
        .addStringOption((o) =>
          o
            .setName('duration')
            .setDescription(t('持續時間，例如 1h30m、2d、90（秒）', 'Duration, e.g. 1h30m, 2d, 90 (sec)'))
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('prizes').setDescription(t('多個獎品（逗號分隔，如 A, B, C）', 'Multiple prizes (comma-separated)'))
        )
        .addIntegerOption((o) => o.setName('winners').setDescription(t('贏家人數（預設 1；多獎品時自動等於獎品數）', 'Winner count (default 1; equals prize count for multiple prizes)')).setMinValue(1))
        .addBooleanOption((o) => o.setName('weighted').setDescription(t('依等級加權（越高級越容易中獎）', 'Weight by level (higher level = better odds)')))
        .addChannelOption((o) => o.setName('channel').setDescription(t('抽獎頻道（預設為目前頻道）', 'Channel (default: current)')))
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription(t('提前結束抽獎', 'End a giveaway early'))
        .addStringOption((o) =>
          o
            .setName('message_id')
            .setDescription(t('抽獎訊息 ID（預設取目前頻道最近一場）', 'Giveaway message ID (default: latest in channel)'))
        )
    )
    .addSubcommand((s) =>
      s
        .setName('reroll')
        .setDescription(t('重新抽獎', 'Reroll giveaway'))
        .addStringOption((o) =>
          o
            .setName('message_id')
            .setDescription(t('抽獎訊息 ID（預設取目前頻道最近一場）', 'Giveaway message ID (default: latest in channel)'))
        )
    )
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription(t('取消抽獎並刪除訊息', 'Cancel giveaway and delete message'))
        .addStringOption((o) =>
          o
            .setName('message_id')
            .setDescription(t('抽獎訊息 ID（預設取目前頻道最近一場）', 'Giveaway message ID (default: latest in channel)'))
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription(t('列出此伺服器進行中的抽獎', 'List active giveaways')))
    .addSubcommand((s) =>
      s
        .setName('participants')
        .setDescription(t('查看抽獎的參加者名單（管理員）', 'View giveaway participants (moderators)'))
        .addStringOption((o) =>
          o
            .setName('message_id')
            .setDescription(t('抽獎訊息 ID（預設取目前頻道最近一場，含已結束）', 'Giveaway message ID (default: latest in channel, incl. ended)'))
        )
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    try {
      if (sub === 'start') {
        if (!(await requireAdmin(interaction))) return;
        const prize = interaction.options.getString('prize');
        const durationMs = parseDuration(interaction.options.getString('duration'));
        if (!durationMs) {
          await sendError(
            interaction,
            t('時間格式無效，請使用例如 `1h30m`、`2d` 或 `90`（秒）。', 'Invalid duration format, use e.g. `1h30m`, `2d` or `90` (seconds).')
          );
          return;
        }
        const winners = Math.max(1, interaction.options.getInteger('winners') || 1);
        const weighted = interaction.options.getBoolean('weighted') || false;
        // 多獎品：逗號分隔
        const prizesRaw = interaction.options.getString('prizes');
        const prizes = prizesRaw
          ? prizesRaw.split(',').map((p) => p.trim()).filter(Boolean)
          : null;
        if (prizesRaw && (!prizes || prizes.length < 2)) {
          await sendError(interaction, t('多獎品請至少用逗號分隔 2 個獎品，例如 `A, B, C`。', 'Please provide at least 2 prizes separated by commas, e.g. `A, B, C`.'));
          return;
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await sendError(interaction, t('抽獎頻道必須是文字頻道。', 'The giveaway channel must be a text channel.'));
          return;
        }
        const message = await giveaways.start(client, channel, durationMs, winners, prize, interaction.user, { prizes, weighted });
        if (message) {
          await sendSuccess(
            interaction,
            t(
              `抽獎已開始：${channel}${prizes ? `（${prizes.length} 個獎品）` : ''}${weighted ? '（等級加權）' : ''}`,
              `Giveaway started: ${channel}${prizes ? ` (${prizes.length} prizes)` : ''}${weighted ? ' (level-weighted)' : ''}`
            )
          );
        }
        return;
      }

      if (sub === 'end' || sub === 'reroll' || sub === 'cancel') {
        const g = resolveGiveaway(client, interaction, interaction.options.getString('message_id'));
        if (!g) {
          await sendError(interaction, t('找不到指定的抽獎。', 'Could not find the specified giveaway.'));
          return;
        }
        if (sub === 'end') {
          const result = await giveaways.end(client, g);
          if (result === null) await sendError(interaction, t('此抽獎已經結束。', 'This giveaway has already ended.'));
          else await sendSuccess(interaction, t('抽獎已結束，贏家已公布！', 'Giveaway ended, winners announced!'));
        } else if (sub === 'reroll') {
          const result = await giveaways.reroll(client, g);
          if (result === null)
            await sendError(
              interaction,
              t('無法重新抽獎（可能尚未結束，或沒有其他可參加的人選）。', 'Cannot reroll (not ended yet, or no other participants).')
            );
          else await sendSuccess(interaction, t('已重新抽獎，新贏家已公布！', 'Rerolled, new winners announced!'));
        } else {
          await giveaways.cancel(client, g);
          await sendSuccess(interaction, t('抽獎已取消並刪除。', 'Giveaway cancelled and deleted.'));
        }
        return;
      }

      if (sub === 'list') {
        const list = client.db
          .collection('giveaways')
          .filter((x) => x.guildId === guild.id && !x.ended)
          .sort((a, b) => (a.endsAt || 0) - (b.endsAt || 0));
        if (list.length === 0) {
          await sendSuccess(interaction, t('目前沒有進行中的抽獎。', 'No active giveaways right now.'));
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(Colors.GIVEAWAY)
          .setTitle(t('🎉 進行中的抽獎', '🎉 Active Giveaways'))
          .setDescription(
            list
              .map(
                (x) =>
                  t(
                    `**${x.prize}** — <#${x.channelId}> — 參加 ${Array.isArray(x.entries) ? x.entries.length : 0} 人 — ${discordTimestamp(x.endsAt, 'R')}`,
                    `**${x.prize}** — <#${x.channelId}> — ${Array.isArray(x.entries) ? x.entries.length : 0} entries — ${discordTimestamp(x.endsAt, 'R')}`
                  )
              )
              .join('\n')
          )
          .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === 'participants') {
        if (!(await requireMod(interaction))) return;
        const g = resolveGiveawayAny(client, interaction, interaction.options.getString('message_id'));
        if (!g) return sendError(interaction, t('找不到指定的抽獎。', 'Giveaway not found.'));
        const entries = Array.isArray(g.entries) ? g.entries : [];
        const prize = g.prize || (Array.isArray(g.prizes) ? g.prizes.join(', ') : '');
        const status = g.ended ? t('已結束', 'Ended') : t('進行中', 'Active');
        const shown = entries.slice(0, 40);
        const more = entries.length > 40 ? t(`…及另外 ${entries.length - 40} 人`, `…and ${entries.length - 40} more`) : '';
        const embed = new EmbedBuilder()
          .setColor(Colors.GIVEAWAY)
          .setTitle(t('👥 參加者名單', '👥 Participants'))
          .setDescription(t(`**${prize}**（${status}）｜共 ${entries.length} 人`, `**${prize}** (${status}) ｜ ${entries.length} total`))
          .addFields({
            name: t('👤 參加者', '👤 Entrants'),
            value: entries.length
              ? shown.map((id) => `<@${id}>`).join(' ') + more
              : t('（尚無參加者）', '(no entrants yet)'),
          });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }
    } catch (e) {
      logger.error('giveaway', `執行 giveaway 指令失敗：${e.stack || e.message}`);
      await sendError(interaction, t('執行 giveaway 指令時發生錯誤，請稍後再試。', 'An error occurred while running the giveaway command, please try again later.'));
    }
  },
};
