const { MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const { Colors } = require('../utils/constants');
const { sendError, sendSuccess } = require('../utils/embeds');
const { isModerator } = require('../core/permissions');
const { logger } = require('../utils/logger');
const { t } = require('../utils/i18n');

/** customId 前綴 */
const PREFIX = 'suggest:';

/** 建立建議 Embed */
function suggestionEmbed(author, text) {
  return new EmbedBuilder()
    .setColor(Colors.SUGGESTION)
    .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
    .setTitle(t('💡 新建議', '💡 New Suggestion'))
    .setDescription(text)
    .setFooter({ text: t(`作者 ID：${author.id}`, `Author ID: ${author.id}`) });
}

/** 建議管理按鈕（核准 / 拒絕 / 刪除） */
function suggestionButtons() {
  const approve = new ButtonBuilder()
    .setCustomId('suggest:approve')
    .setLabel(t('✅ 核准', '✅ Approve'))
    .setStyle(ButtonStyle.Success);
  const deny = new ButtonBuilder()
    .setCustomId('suggest:deny')
    .setLabel(t('❌ 拒絕', '❌ Deny'))
    .setStyle(ButtonStyle.Danger);
  const del = new ButtonBuilder()
    .setCustomId('suggest:delete')
    .setLabel(t('🗑️ 刪除', '🗑️ Delete'))
    .setStyle(ButtonStyle.Secondary);
  return [new ActionRowBuilder().addComponents(approve, deny, del)];
}

/**
 * 發布建議到指定頻道，並加上 👍 / 👎 表情供大眾投票
 */
async function post(client, guild, channel, author, text) {
  const message = await channel.send({
    embeds: [suggestionEmbed(author, text)],
    components: suggestionButtons(),
  });
  client.db.collection('suggestions').set(message.id, {
    guildId: guild.id,
    authorId: author.id,
    text,
    status: 'pending',
  });
  try {
    await message.react('👍');
    await message.react('👎');
  } catch (e) {
    logger.warn('suggestions', `表情符號新增失敗：${e.message}`);
  }
  return message;
}

/** 按鈕分派：核准 / 拒絕 / 刪除（僅限管理人員） */
async function handleButton(client, interaction) {
  const id = interaction.customId || '';
  if (!id.startsWith(PREFIX)) return false;
  try {
    if (!isModerator(interaction.member)) {
      await sendError(interaction, t('只有管理人員可以管理建議。', 'Only moderators can manage suggestions.'));
      return true;
    }

    const col = client.db.collection('suggestions');
    const messageId = interaction.message.id;

    if (id === 'suggest:delete') {
      await interaction.message.delete().catch(() => {});
      col.delete(messageId);
      const payload = { content: t('✅ 已刪除該建議。', '✅ Suggestion deleted.'), flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
      return true;
    }

    const isApproved = id === 'suggest:approve';
    const status = isApproved ? 'approved' : 'denied';

    // 更新 Embed（保留原本的 author / description / footer）
    const orig = interaction.message.embeds[0];
    const raw = orig && orig.data ? orig.data : orig;
    const updated = EmbedBuilder.from(raw)
      .setTitle(isApproved ? t('✅ 已核准', '✅ Approved') : t('❌ 已拒絕', '❌ Denied'))
      .setColor(isApproved ? Colors.SUCCESS : Colors.ERROR);

    // 停用所有按鈕
    const rows = interaction.message.components.map((row) => {
      const r = row.data || row;
      const components = Array.isArray(r.components) ? r.components : [];
      return new ActionRowBuilder({
        components: components.map((c) => ButtonBuilder.from(c).setDisabled(true)),
      });
    });

    await interaction.update({ embeds: [updated], components: rows });
    col.update(
      messageId,
      (cur) => ({ ...cur, status }),
      { guildId: interaction.guild.id, authorId: interaction.user.id, text: '', status }
    );
    await interaction.followUp({
      content: isApproved ? t('✅ 已核准此建議。', '✅ Suggestion approved.') : t('❌ 已拒絕此建議。', '❌ Suggestion denied.'),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  } catch (e) {
    logger.error('suggestions', `handleButton 錯誤：${e.stack || e.message}`);
    try {
      await sendError(interaction, t('處理建議時發生錯誤，請稍後再試。', 'An error occurred while handling the suggestion, please try again later.'));
    } catch (e2) {
      /* ignore */
    }
    return true;
  }
}

module.exports = {
  post,
  handleButton,
};
