const { MessageFlags, EmbedBuilder } = require('discord.js');
const { Colors } = require('./constants');
const { t } = require('./i18n');

/**
 * 建立基礎 Embed
 * @param {number} color
 * @param {{title?:string, description?:string, footer?:boolean, timestamp?:boolean}} opts
 */
function base(color, opts = {}) {
  const e = new EmbedBuilder().setColor(color);
  if (opts.title) e.setTitle(opts.title);
  if (opts.description) e.setDescription(opts.description);
  if (opts.timestamp !== false) e.setTimestamp();
  return e;
}

/** 一般資訊嵌入 */
function info(title, description, opts = {}) {
  return base(Colors.INFO, { title, description, ...opts });
}

/** 成功嵌入 */
function success(title, description, opts = {}) {
  return base(Colors.SUCCESS, { title, description, ...opts });
}

/** 錯誤嵌入 */
function error(title, description, opts = {}) {
  return base(Colors.ERROR, { title, description, ...opts });
}

/** 警告嵌入 */
function warn(title, description, opts = {}) {
  return base(Colors.WARN, { title, description, ...opts });
}

/** 為 Embed 加上機器人頁尾 */
function withFooter(embed, client, text) {
  embed.setFooter({
    text: text || client?.user?.username || 'Discord Bot',
    iconURL: client?.user?.displayAvatarURL?.() || undefined,
  });
  return embed;
}

/**
 * 安全回應互動（處理 deferred/replied 狀態）
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').InteractionReplyOptions} payload
 */
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (e) {
    return null;
  }
}

/** 回覆錯誤訊息（ephemeral） */
async function sendError(interaction, description) {
  return safeReply(interaction, { embeds: [error(t('❌ 發生錯誤', '❌ Error'), description)], flags: MessageFlags.Ephemeral });
}

/** 回覆成功訊息（ephemeral） */
async function sendSuccess(interaction, description) {
  return safeReply(interaction, { embeds: [success(t('✅ 完成', '✅ Done'), description)], flags: MessageFlags.Ephemeral });
}

/**
 * 從通用資料建立 Embed（用於自訂指令 / embed 產生器）
 * @param {{title?:string, description?:string, color?:string|number, fields?:Array<{name:string, value:string, inline?:boolean}>, image?:string, thumbnail?:string, footer?:string, author?:string, url?:string}} data
 */
function embedFromData(data = {}) {
  const color = typeof data.color === 'string' && data.color ? parseInt(data.color.replace('#', ''), 16) : Colors.MAIN;
  const e = new EmbedBuilder().setColor(Number.isNaN(color) ? Colors.MAIN : color);
  if (data.title) e.setTitle(String(data.title));
  if (data.description) e.setDescription(String(data.description));
  if (data.url) e.setURL(String(data.url));
  if (Array.isArray(data.fields)) {
    for (const f of data.fields.slice(0, 25)) {
      if (f && f.name) e.addFields({ name: String(f.name).slice(0, 256), value: String(f.value || '—').slice(0, 1024), inline: !!f.inline });
    }
  }
  if (data.image) e.setImage(String(data.image));
  if (data.thumbnail) e.setThumbnail(String(data.thumbnail));
  if (data.footer) e.setFooter({ text: String(data.footer) });
  if (data.author) e.setAuthor({ name: String(data.author) });
  return e;
}

module.exports = { base, info, success, error, warn, withFooter, safeReply, sendError, sendSuccess, embedFromData };
