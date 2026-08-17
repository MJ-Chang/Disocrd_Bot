/** 自動審核 / 反垃圾 / 反突襲 */
const { InviteRegex, LinkRegex } = require('../utils/constants');
const { isModerator } = require('../core/permissions');
const { t } = require('../utils/i18n');
const { addWarn, logModAction } = require('./moderation');

/** 每用戶訊息時間戳（anti-spam）：key = guildId:userId */
const spamMap = new Map();
/** 每用戶重複內容計數（anti-duplicate）：key = guildId:userId */
const duplicateMap = new Map();
/** 反突襲事件計數：key = guildId -> Map(actorId -> [{type, ts}]) */
const raidMap = new Map();

const ACTION_LABELS = {
  delete: t('刪除訊息', 'Delete message'),
  warn: t('警告', 'Warn'),
  timeout: t('禁言', 'Timeout'),
  kick: t('踢出', 'Kick'),
  ban: t('封鎖', 'Ban'),
};

/** 檢查訊息是否符合任何自動審核規則（未命中回傳 null） */
async function checkMessage(client, message) {
  try {
    if (!message.guild || !message.author || message.author.bot) return null;
    const s = await client.settings.get(message.guild.id);
    const am = (s && s.automod) || {};
    if (!am.enabled) return null;
    const member = message.member;
    if (!member) return null;
    if (isModerator(member)) return null;
    if (Array.isArray(am.ignoreChannels) && am.ignoreChannels.includes(message.channel.id)) return null;

    const action = am.action || 'delete';
    const content = message.content || '';
    const lower = content.toLowerCase();

    // 1. 違規詞彙
    if (Array.isArray(am.bannedWords) && am.bannedWords.length > 0 && content) {
      for (const w of am.bannedWords) {
        if (w && lower.includes(String(w).toLowerCase())) {
          return { action, reason: t(`偵測到違規詞彙「${w}」`, `Banned word detected: "${w}"`) };
        }
      }
    }

    // 2. 邀請連結
    if (am.invites && content) {
      InviteRegex.lastIndex = 0;
      if (InviteRegex.test(content)) return { action, reason: t('偵測到 Discord 邀請連結', 'Discord invite link detected') };
    }

    // 3. 一般連結
    if (am.links && content) {
      LinkRegex.lastIndex = 0;
      if (LinkRegex.test(content)) return { action, reason: t('偵測到不明連結', 'Suspicious link detected') };
    }

    // 4. 過多大寫
    if (am.caps && content.length >= (am.capsMinLength || 8)) {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 0) {
        const ratio = letters.replace(/[^A-Z]/g, '').length / letters.length;
        if (ratio >= (am.capsPercent || 70) / 100) {
          return { action, reason: t('訊息包含過多大寫字母', 'Message contains too many capital letters') };
        }
      }
    }

    // 5. 過多提及
    if (am.mentions) {
      const count = message.mentions.members.size + message.mentions.users.size + message.mentions.roles.size;
      if (count > (am.mentionLimit || 5)) {
        return { action, reason: t(`短時間內提及過多成員（${count} 次）`, `Too many mentions at once (${count})`) };
      }
    }

    // 6. 洗頻（spamWindow 毫秒內訊息數 >= spamThreshold）
    if (am.spam) {
      const now = Date.now();
      const win = am.spamWindow || 6000;
      const key = `${message.guild.id}:${message.author.id}`;
      let arr = spamMap.get(key) || [];
      arr.push(now);
      arr = arr.filter((t2) => now - t2 <= win);
      if (arr.length > 100) arr = arr.slice(-100);
      spamMap.set(key, arr);
      if (arr.length >= (am.spamThreshold || 5)) {
        return { action, reason: t(`短時間內連續發送 ${arr.length} 則訊息（疑似洗頻）`, `Sent ${arr.length} messages in a short time (spam)`) };
      }
    }

    // 7. 重複內容（duplicateWindow 內相同內容 >= duplicateThreshold 次）
    if (am.duplicate && content) {
      const now = Date.now();
      const win = am.duplicateWindow || 60000;
      const key = `${message.guild.id}:${message.author.id}`;
      const norm = lower.trim();
      let arr = duplicateMap.get(key) || [];
      arr.push({ content: norm, ts: now });
      arr = arr.filter((e) => now - e.ts <= win);
      if (arr.length > 200) arr = arr.slice(-200);
      duplicateMap.set(key, arr);
      const count = arr.filter((e) => e.content === norm).length;
      if (count >= (am.duplicateThreshold || 3)) {
        return { action, reason: t(`重複發送相同內容 ${count} 次`, `Sent the same content ${count} times`) };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

/** 依規則執行自動處罰，並嘗試 DM 通知與記錄管理日誌 */
async function executeAction(client, message, action, reason) {
  try {
    if (!message.guild || !message.author) return;
    const guild = message.guild;
    const author = message.author;
    const member = message.member;

    switch (action) {
      case 'delete':
        await message.delete().catch(() => {});
        break;
      case 'warn':
        await addWarn(client, guild.id, author.id, client.user.id, reason || '自動審核');
        break;
      case 'timeout':
        if (member) await member.timeout(10 * 60 * 1000, reason).catch(() => {});
        break;
      case 'kick':
        if (member) await member.kick(reason).catch(() => {});
        break;
      case 'ban':
        await guild.members.ban(author.id, { reason }).catch(() => {});
        break;
      default:
        await message.delete().catch(() => {});
    }

    // DM 通知（失敗靜默）
    try {
      await author.send(
        t(
          `你在 **${guild.name}** 的訊息違反規則，已被系統自動處理（${ACTION_LABELS[action] || action}）。\n原因：${reason}`,
          `Your message in **${guild.name}** violated the rules and was automatically handled (${ACTION_LABELS[action] || action}).\nReason: ${reason}`
        )
      );
    } catch (e) {
      /* DM 關閉或失敗，忽略 */
    }

    await logModAction(client, guild, t(`自動${ACTION_LABELS[action] || action}（automod）`, `Auto-${ACTION_LABELS[action] || action} (automod)`), author, client.user, reason);
  } catch (e) {
    /* 靜默，不讓錯誤外洩 */
  }
}

/**
 * 反突襲檢查：單一使用者於 window 毫秒內觸發 >= threshold 個管理事件時，
 * 依設定對其執行 ban 或 kick。
 * @returns {Promise<boolean>} 是否已觸發並執行處罰
 */
async function checkRaid(client, guild, actorId, eventType) {
  try {
    if (!guild || !actorId) return false;
    const s = await client.settings.get(guild.id);
    const ar = (s && s.antiRaid) || {};
    if (!ar.enabled) return false;

    const now = Date.now();
    const windowMs = ar.window || 10000;
    const threshold = ar.threshold || 5;

    let guildMap = raidMap.get(guild.id);
    if (!guildMap) {
      guildMap = new Map();
      raidMap.set(guild.id, guildMap);
    }
    let events = guildMap.get(actorId) || [];
    events.push({ type: eventType, ts: now });
    events = events.filter((e) => now - e.ts <= windowMs);
    guildMap.set(actorId, events);

    if (events.length < threshold) return false;

    const isBan = ar.action !== 'kick';
    const reason = t('反突襲：短時間內觸發多個管理事件', 'Anti-raid: multiple moderation events in a short time');
    if (isBan) {
      await guild.members.ban(actorId, { reason }).catch(() => {});
    } else {
      const member = guild.members.cache.get(actorId) || (await guild.members.fetch(actorId).catch(() => null));
      if (!member) return false;
      await member.kick(reason).catch(() => {});
    }
    guildMap.delete(actorId);

    // ban/kick 後成員會從快取移除，改用使用者快取取得顯示名稱
    const target = client.users.cache.get(actorId) || guild.members.cache.get(actorId) || { id: actorId };
    await logModAction(client, guild, isBan ? t('封鎖（反突襲）', 'Ban (anti-raid)') : t('踢出（反突襲）', 'Kick (anti-raid)'), target, client.user, reason);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { checkMessage, executeAction, checkRaid };
