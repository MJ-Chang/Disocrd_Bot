const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Colors } = require('../utils/constants');
const { formatCompact } = require('../utils/format');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/**
 * 投票系統（持久化）：最多 10 個選項，按鈕投票（單選），可結束。
 * 投票資料存入資料庫 collection 'polls'，機器人重啟後仍然有效。
 * customId 前綴：poll:
 */
const POLLS = new Map(); // messageId -> poll（記憶體快取，開機從 DB 載入）

const col = (client) => client.db.collection('polls');

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/** 序列化投票（Set → 陣列，供 DB 儲存） */
function serialize(poll) {
  const votes = {};
  for (const [i, s] of poll.votes) votes[i] = [...s];
  return {
    guildId: poll.guildId,
    authorId: poll.authorId,
    question: poll.question,
    options: poll.options,
    votes,
    ended: poll.ended,
  };
}

/** 反序列化（陣列 → Set） */
function deserialize(entry, messageId) {
  const votes = new Map();
  for (const [i, ids] of Object.entries(entry.votes || {})) votes.set(Number(i), new Set(ids));
  return { messageId, guildId: entry.guildId, authorId: entry.authorId, question: entry.question, options: entry.options, votes, ended: !!entry.ended };
}

async function savePoll(client, poll) {
  col(client).set(poll.messageId, serialize(poll));
}

/** 取得投票（先查記憶體快取，再查 DB） */
async function getPoll(client, messageId) {
  if (POLLS.has(messageId)) return POLLS.get(messageId);
  const entry = col(client).get(messageId);
  if (!entry) return null;
  const poll = deserialize(entry, messageId);
  POLLS.set(messageId, poll);
  return poll;
}

function buildEmbed(poll) {
  const total = [...poll.votes.values()].reduce((sum, s) => sum + s.size, 0);
  const lines = poll.options.map((opt, i) => {
    const count = poll.votes.get(i)?.size || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    return `${EMOJI_NUMBERS[i]} **${opt}**\n\`${bar}\` ${t(`${count} 票（${pct}%）`, `${count} votes (${pct}%)`)}`;
  });
  return new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle(`📊 ${poll.question}`)
    .setDescription(lines.join('\n\n'))
    .addFields({ name: t('📈 總票數', '📈 Total Votes'), value: t(`${formatCompact(total)} 票`, `${formatCompact(total)} votes`), inline: true })
    .setFooter({ text: poll.ended ? t('投票已結束', 'Poll ended') : t('點擊下方按鈕投票', 'Click a button below to vote') })
    .setTimestamp();
}

function buildComponents(poll) {
  const rows = [];
  const buttons = poll.options.map((_, i) =>
    new ButtonBuilder()
      .setCustomId(`poll:vote:${i}`)
      .setEmoji(EMOJI_NUMBERS[i])
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(poll.ended)
  );
  const maxPerRow = 5;
  for (let i = 0; i < buttons.length; i += maxPerRow) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + maxPerRow)));
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll:end')
        .setLabel(t('結束投票', 'End Poll'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(poll.ended)
    )
  );
  return rows;
}

/** 建立投票（options 至少 2 個、最多 10 個）並存入資料庫 */
async function createPoll(client, interaction, question, options) {
  const votes = new Map();
  options.forEach((_, i) => votes.set(i, new Set()));
  const poll = { messageId: null, guildId: interaction.guild.id, authorId: interaction.user.id, question, options, votes, ended: false };
  const payload = { embeds: [buildEmbed(poll)], components: buildComponents(poll), fetchReply: true };
  const message =
    interaction.deferred || interaction.replied
      ? await interaction.editReply(payload)
      : await interaction.reply(payload);
  poll.messageId = message.id;
  await savePoll(client, poll);
  POLLS.set(message.id, poll);
  return message;
}

async function handleButton(client, interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('poll:')) return false;

  const poll = await getPoll(client, interaction.message.id);
  if (!poll) {
    await interaction.reply({ content: t('❌ 找不到此投票。', '❌ This poll could not be found.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (customId === 'poll:end') {
    if (poll.authorId !== interaction.user.id && !interaction.member.permissions.has('ManageMessages')) {
      await interaction.reply({ content: t('❌ 只有發起投票的人或管理人員可以結束投票。', '❌ Only the poll creator or moderators can end this poll.'), flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    poll.ended = true;
    await savePoll(client, poll);
    await interaction.update({ embeds: [buildEmbed(poll)], components: buildComponents(poll) }).catch(() => {});
    return true;
  }

  const idx = parseInt(customId.split(':')[2], 10);
  if (Number.isNaN(idx) || !poll.votes.has(idx)) {
    await interaction.reply({ content: t('❌ 無效的投票選項。', '❌ Invalid poll option.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (poll.ended) {
    await interaction.reply({ content: t('❌ 投票已結束。', '❌ The poll has ended.'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  // 單選：先移除該用戶在其他選項的票
  for (const set of poll.votes.values()) set.delete(interaction.user.id);
  poll.votes.get(idx).add(interaction.user.id);
  await savePoll(client, poll);

  await interaction.update({ embeds: [buildEmbed(poll)], components: buildComponents(poll) }).catch(() => {});
  await interaction.followUp({ content: t(`✅ 已投票給 **${poll.options[idx]}**`, `✅ Voted for **${poll.options[idx]}**`), flags: MessageFlags.Ephemeral }).catch(() => {});
  return true;
}

/** 開機初始化：從資料庫載入所有投票（持久化） */
async function onReady(client) {
  try {
    const all = col(client).all();
    for (const entry of all) {
      POLLS.set(entry.id, deserialize(entry, entry.id));
    }
    if (all.length > 0) logger.info('polls', `已載入 ${all.length} 個投票（持久化）`);
  } catch (e) {
    logger.error('polls', `載入投票失敗：${e.message}`);
  }
}

module.exports = { createPoll, handleButton, onReady, getPoll, savePoll };
