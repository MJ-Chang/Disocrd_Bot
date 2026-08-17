const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Colors } = require('../utils/constants');
const { formatCompact } = require('../utils/format');
const { t } = require('../utils/i18n');

/**
 * 投票系統：最多 10 個選項，按鈕投票（單選），可結束。
 * 狀態僅存記憶體（重啟後失效）。customId 前綴：poll:
 */
const POLLS = new Map(); // messageId -> { guildId, authorId, question, options, votes: Map<idx, Set<userId>>, ended }

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

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

/** 建立投票（options 至少 2 個、最多 10 個） */
async function createPoll(client, interaction, question, options) {
  const votes = new Map();
  options.forEach((_, i) => votes.set(i, new Set()));
  const poll = { guildId: interaction.guild.id, authorId: interaction.user.id, question, options, votes, ended: false };
  const payload = { embeds: [buildEmbed(poll)], components: buildComponents(poll), fetchReply: true };
  const message =
    interaction.deferred || interaction.replied
      ? await interaction.editReply(payload)
      : await interaction.reply(payload);
  POLLS.set(message.id, poll);
  return message;
}

async function handleButton(client, interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('poll:')) return false;

  const poll = POLLS.get(interaction.message.id);
  if (!poll) {
    await interaction.reply({ content: t('❌ 此投票已失效（機器人重啟後投票紀錄會清除）。', '❌ This poll is no longer active (records are cleared on bot restart).'), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  if (customId === 'poll:end') {
    if (poll.authorId !== interaction.user.id && !interaction.member.permissions.has('ManageMessages')) {
      await interaction.reply({ content: t('❌ 只有發起投票的人或管理人員可以結束投票。', '❌ Only the poll creator or moderators can end this poll.'), flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    poll.ended = true;
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

  await interaction.update({ embeds: [buildEmbed(poll)], components: buildComponents(poll) }).catch(() => {});
  await interaction.followUp({ content: t(`✅ 已投票給 **${poll.options[idx]}**`, `✅ Voted for **${poll.options[idx]}**`), flags: MessageFlags.Ephemeral }).catch(() => {});
  return true;
}

module.exports = { createPoll, handleButton };
