const { MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const { Colors } = require('../utils/constants');
const { discordTimestamp } = require('../utils/format');
const { sendError, sendSuccess } = require('../utils/embeds');
const { logger } = require('../utils/logger');
const { t } = require('../utils/i18n');

/** customId 前綴 */
const PREFIX = 'giveaway:';

/** messageId -> setTimeout handle（結束計時器） */
const timers = new Map();

/** 建立抽獎 Embed */
function buildEmbed(giveaway) {
  const entries = Array.isArray(giveaway.entries) ? giveaway.entries : [];
  const embed = new EmbedBuilder()
    .setColor(Colors.GIVEAWAY)
    .setTitle(`🎉 ${giveaway.prize}`)
    .addFields(
      { name: t('🎁 獎品', '🎁 Prize'), value: giveaway.prize, inline: true },
      { name: t('👥 參加人數', '👥 Entries'), value: `${entries.length}`, inline: true },
      { name: t('⏰ 結束時間', '⏰ Ends'), value: discordTimestamp(giveaway.endsAt, 'R'), inline: true },
      { name: t('👑 主辦人', '👑 Host'), value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setTimestamp();
  if (giveaway.ended) {
    embed.setDescription(t('**此抽獎已結束**', '**This giveaway has ended**'));
    const picked = Array.isArray(giveaway.picked) ? giveaway.picked : [];
    embed.addFields({
      name: t('🏆 贏家', '🏆 Winners'),
      value: picked.length ? picked.map((id) => `<@${id}>`).join(' ') : t('無人得獎', 'No winners'),
    });
  }
  return embed;
}

/** 參加按鈕 */
function entryButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway:enter').setLabel(t('🎉 參加抽獎', '🎉 Join giveaway')).setStyle(ButtonStyle.Primary)
  );
}

/** Fisher–Yates 洗牌（不修改原陣列） */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimer(messageId) {
  if (timers.has(messageId)) {
    clearTimeout(timers.get(messageId));
    timers.delete(messageId);
  }
}

/** 更新抽獎訊息（結束 / 重抽時） */
async function refreshMessage(client, giveaway) {
  try {
    const channel = client.channels.cache.get(giveaway.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return;
    await message.edit({ embeds: [buildEmbed(giveaway)], components: [] }).catch(() => {});
  } catch (e) {
    logger.warn('giveaways', `更新抽獎訊息失敗：${e.message}`);
  }
}

/**
 * 開始一場抽獎
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function start(client, channel, durationMs, winners, prize, host) {
  const endsAt = Date.now() + durationMs;
  const giveaway = {
    guildId: (channel.guild && channel.guild.id) || channel.guildId || null,
    channelId: channel.id,
    prize,
    winners: Math.max(1, winners),
    endsAt,
    hostId: host.id,
    entries: [],
    ended: false,
    messageId: null,
    picked: [],
  };

  const message = await channel.send({
    embeds: [buildEmbed(giveaway)],
    components: [entryButton()],
  });
  giveaway.messageId = message.id;
  client.db.collection('giveaways').set(message.id, giveaway);

  const timer = setTimeout(() => {
    end(client, giveaway);
  }, durationMs);
  timers.set(message.id, timer);

  return message;
}

/**
 * 結束抽獎：隨機選出贏家、更新訊息、宣布結果
 * @returns {Promise<object|null>} 已結束回傳 null
 */
async function end(client, giveaway) {
  const col = client.db.collection('giveaways');
  const current = col.get(giveaway.messageId) || giveaway;
  if (current.ended) return null;

  clearTimer(current.messageId);

  const entries = Array.isArray(current.entries) ? current.entries : [];
  const picked = shuffle(entries).slice(0, Math.max(1, current.winners || 1));
  current.ended = true;
  current.picked = picked;
  current.endedAt = Date.now();
  col.set(current.messageId, current);

  await refreshMessage(client, current);

  // 宣布贏家
  try {
    const channel = client.channels.cache.get(current.channelId);
    if (channel) {
      if (picked.length > 0) {
        await channel.send({
          content: t(
            `${picked.map((id) => `<@${id}>`).join(' ')} 恭喜贏得 **${current.prize}**！`,
            `${picked.map((id) => `<@${id}>`).join(' ')} won **${current.prize}**!`
          ),
        });
      } else {
        await channel.send({
          content: t(
            `很可惜，**${current.prize}** 的抽獎沒有任何人參加，本次抽獎取消。`,
            `Sadly, nobody joined the **${current.prize}** giveaway, so it was cancelled.`
          ),
        });
      }
    }
  } catch (e) {
    logger.warn('giveaways', `宣布贏家失敗：${e.message}`);
  }

  return current;
}

/**
 * 重新抽獎：從參加者中排除已當選者，重新選出贏家
 * @returns {Promise<object|null>} 抽獎未結束或無其他參加者時回傳 null
 */
async function reroll(client, giveaway) {
  const col = client.db.collection('giveaways');
  const current = col.get(giveaway.messageId) || giveaway;
  if (!current.ended) return null;

  const entries = Array.isArray(current.entries) ? current.entries : [];
  const exclude = new Set(Array.isArray(current.picked) ? current.picked : []);
  const pool = entries.filter((id) => !exclude.has(id));
  if (pool.length === 0) return null;

  const picked = shuffle(pool).slice(0, Math.max(1, current.winners || 1));
  current.picked = [...(Array.isArray(current.picked) ? current.picked : []), ...picked];
  col.set(current.messageId, current);

  await refreshMessage(client, current);

  try {
    const channel = client.channels.cache.get(current.channelId);
    if (channel) {
      await channel.send({
        content: t(
          `🎉 重新抽獎！${picked.map((id) => `<@${id}>`).join(' ')} 恭喜贏得 **${current.prize}**！`,
          `🎉 Reroll! ${picked.map((id) => `<@${id}>`).join(' ')} won **${current.prize}**!`
        ),
      });
    }
  } catch (e) {
    logger.warn('giveaways', `重新抽獎宣布失敗：${e.message}`);
  }

  return current;
}

/** 取消抽獎：刪除訊息與紀錄 */
async function cancel(client, giveaway) {
  clearTimer(giveaway.messageId);
  const channel = client.channels.cache.get(giveaway.channelId);
  if (channel) {
    await channel.messages.delete(giveaway.messageId).catch(() => {});
  }
  client.db.collection('giveaways').delete(giveaway.messageId);
}

/** 按鈕分派：giveaway:enter */
async function handleButton(client, interaction) {
  const id = interaction.customId || '';
  if (!id.startsWith(PREFIX)) return false;
  try {
    const col = client.db.collection('giveaways');
    const messageId = interaction.message.id;
    const giveaway = col.get(messageId);
    if (!giveaway) {
      await sendError(interaction, t('找不到此抽獎紀錄。', 'Giveaway record not found.'));
      return true;
    }
    if (giveaway.ended) {
      await sendError(interaction, t('抽獎已結束。', 'The giveaway has ended.'));
      return true;
    }

    const entries = Array.isArray(giveaway.entries) ? giveaway.entries : [];
    const idx = entries.indexOf(interaction.user.id);
    let msg;
    if (idx !== -1) {
      entries.splice(idx, 1);
      msg = t('已取消參加抽獎。', 'Left the giveaway.');
    } else {
      entries.push(interaction.user.id);
      msg = t('🎉 已參加抽獎！', '🎉 Joined the giveaway!');
    }
    giveaway.entries = entries;
    col.set(messageId, giveaway);

    try {
      await interaction.update({ embeds: [buildEmbed(giveaway)] });
    } catch (e) {
      await sendError(interaction, t('更新抽獎資訊失敗，請稍後再試。', 'Failed to update the giveaway, please try again later.'));
      return true;
    }
    await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    return true;
  } catch (e) {
    logger.error('giveaways', `handleButton 錯誤：${e.stack || e.message}`);
    try {
      await sendError(interaction, t('處理抽獎互動時發生錯誤，請稍後再試。', 'An error occurred while handling the giveaway, please try again later.'));
    } catch (e2) {
      /* ignore */
    }
    return true;
  }
}

/** 開機初始化：還原未結束抽獎的計時器 */
async function onReady(client) {
  const col = client.db.collection('giveaways');
  for (const g of col.all()) {
    try {
      if (g.ended) continue;
      const remaining = (g.endsAt || 0) - Date.now();
      if (remaining <= 0) {
        await end(client, g);
      } else {
        timers.set(g.id, setTimeout(() => end(client, g), remaining));
      }
    } catch (e) {
      logger.warn('giveaways', `onReady 還原抽獎 ${g.id} 失敗：${e.message}`);
    }
  }
}

module.exports = {
  start,
  end,
  reroll,
  cancel,
  handleButton,
  onReady,
};
