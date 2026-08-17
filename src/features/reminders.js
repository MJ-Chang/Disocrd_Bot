/** 提醒系統功能模組 */
const crypto = require('crypto');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

const col = (client) => client.db.collection('reminders');
const timers = new Map(); // id -> setTimeout handle

/** 產生隨機 ID */
function genId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** 觸發提醒：先 DM 用戶，失敗則改送原頻道，最後刪除資料庫紀錄 */
async function fire(client, id) {
  timers.delete(id);
  const data = col(client).get(id);
  if (!data) return;
  col(client).delete(id);

  // 先嘗試 DM
  try {
    const user = await client.users.fetch(data.userId).catch(() => null);
    if (user) {
      await user.send(t(`⏰ 提醒：${data.text}`, `⏰ Reminder: ${data.text}`));
      return;
    }
  } catch (e) {
    /* DM 失敗，改用頻道 */
  }

  // DM 失敗 → 若 channelId 存在且在 guild 中則在該頻道發送
  if (data.channelId && data.guildId) {
    try {
      const guild = client.guilds.cache.get(data.guildId);
      const channel = guild ? await guild.channels.fetch(data.channelId).catch(() => null) : null;
      if (channel && channel.isTextBased()) {
        await channel.send(t(`<@${data.userId}> ⏰ 提醒：${data.text}`, `<@${data.userId}> ⏰ Reminder: ${data.text}`));
        return;
      }
    } catch (e) {
      logger.warn('reminders', `頻道發送提醒失敗（${id}）：${e.message}`);
    }
  }

  logger.warn('reminders', `提醒 ${id} 無法送達（${data.text}）`);
}

/** 啟動計時器（超過 setTimeout 上限則等下次開機再排程） */
function armTimer(client, id) {
  const data = col(client).get(id);
  if (!data) return;
  const delay = data.at - Date.now();
  if (delay <= 0) {
    fire(client, id).catch((e) => logger.error('reminders', `立即觸發失敗（${id}）：${e.message}`));
    return;
  }
  if (delay > 2147483647) return;
  const handle = setTimeout(() => {
    fire(client, id).catch((e) => logger.error('reminders', `觸發失敗（${id}）：${e.message}`));
  }, delay);
  timers.set(id, handle);
}

/**
 * 排程提醒並寫入資料庫。
 * entry: { userId, guildId?, channelId?, text, at, createdAt? }
 */
async function schedule(client, entry) {
  const id = entry.id || genId();
  const data = {
    id,
    userId: entry.userId,
    guildId: entry.guildId || null,
    channelId: entry.channelId || null,
    text: String(entry.text || ''),
    at: Number(entry.at) || 0,
    createdAt: entry.createdAt || Date.now(),
  };
  col(client).set(id, data);
  armTimer(client, id);
  return data;
}

/** 開機初始化：對所有尚未到期的提醒重新排程（過期的直接清除） */
async function onReady(client) {
  try {
    const now = Date.now();
    for (const entry of col(client).all()) {
      if (entry.at > now) armTimer(client, entry.id);
      else col(client).delete(entry.id);
    }
  } catch (e) {
    logger.error('reminders', `onReady 失敗：${e.message}`);
  }
}

/** 列出使用者的待執行提醒（依時間排序） */
async function list(client, userId) {
  return col(client)
    .all()
    .filter((e) => e.userId === userId && e.at > Date.now())
    .sort((a, b) => a.at - b.at);
}

/** 依 ID 刪除提醒（含取消計時器）；成功回傳 true */
async function removeById(client, id) {
  const handle = timers.get(id);
  if (handle) {
    clearTimeout(handle);
    timers.delete(id);
  }
  return col(client).delete(id);
}

module.exports = { schedule, onReady, list, removeById };
