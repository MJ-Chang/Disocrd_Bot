const { logger } = require('../utils/logger');

/**
 * 比對設定的表情字串與反應表情是否相符。
 * Unicode 表情比 reaction.emoji.name；自訂表情比 <:name:id> 或 <a:name:id>。
 * @param {string} configured 設定中儲存的表情字串
 * @param {import('discord.js').MessageReaction['emoji']} emoji reaction.emoji
 * @returns {boolean}
 */
function emojiMatches(configured, emoji) {
  if (!configured || !emoji) return false;
  if (emoji.id) {
    const name = emoji.name || '';
    return configured === `<:${name}:${emoji.id}>` || configured === `<a:${name}:${emoji.id}>`;
  }
  return configured === emoji.name;
}

/**
 * 解析（可能是 partial 的）訊息與反應，回傳完整訊息；失敗回傳 null。
 * @param {import('discord.js').MessageReaction} reaction
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function resolveMessage(reaction) {
  try {
    let message = reaction.message;
    if (message?.partial) {
      message = await reaction.message.fetch();
    }
    if (reaction.partial) {
      await reaction.fetch();
    }
    return message || null;
  } catch (e) {
    logger.debug('reactionRoles', `解析 partial 訊息失敗：${e.message}`);
    return null;
  }
}

/**
 * 處理反應身分組（新增/移除共用邏輯）
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').MessageReaction} reaction
 * @param {import('discord.js').User} user
 * @param {boolean} isAdd true=加入反應，false=移除反應
 */
async function handleReaction(client, reaction, user, isAdd) {
  try {
    if (user.bot) return;

    const message = await resolveMessage(reaction);
    if (!message || !message.guild) return;

    const guild = message.guild;
    const settings = await client.settings.get(guild.id);
    const configs = Array.isArray(settings.reactionRoles)
      ? settings.reactionRoles.filter((c) => c && c.guildId === guild.id && c.messageId === message.id)
      : [];
    if (!configs.length) return;

    // 取得成員（先 cache 後 fetch）
    let member = guild.members.cache.get(user.id);
    if (!member) {
      try {
        member = await guild.members.fetch(user.id);
      } catch (e) {
        member = null;
      }
    }
    if (!member) return;

    for (const cfg of configs) {
      try {
        if (!emojiMatches(cfg.emoji, reaction.emoji)) continue;
        const role = guild.roles.cache.get(cfg.roleId);
        if (!role) continue;

        if (isAdd) {
          if (!member.roles.cache.has(role.id)) await member.roles.add(role);
        } else {
          if (member.roles.cache.has(role.id)) await member.roles.remove(role);
        }
      } catch (e) {
        logger.error('reactionRoles', `${isAdd ? '授予' : '移除'}身分組失敗（${guild.id} / ${cfg.roleId}）：${e.message}`);
      }
    }
  } catch (e) {
    logger.error('reactionRoles', `反應處理失敗：${e.stack || e.message}`);
  }
}

/** 成員對訊息加入反應 */
async function handleReactionAdd(client, reaction, user) {
  return handleReaction(client, reaction, user, true);
}

/** 成員移除對訊息的 reactions */
async function handleReactionRemove(client, reaction, user) {
  return handleReaction(client, reaction, user, false);
}

module.exports = { handleReactionAdd, handleReactionRemove, emojiMatches };
