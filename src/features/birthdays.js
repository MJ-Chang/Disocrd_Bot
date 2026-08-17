/** 生日系統功能模組 */
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

const col = (client) => client.db.collection('birthdays');
const key = (guildId, userId) => `${guildId}:${userId}`;

/** 避免同一天重複公告：`${guildId}:${userId}:${日期字串}` -> 日期字串 */
const sentToday = new Map();

/** 設定生日（值 { month, day, year }） */
async function set(client, guildId, userId, month, day) {
  const existing = col(client).get(key(guildId, userId)) || {};
  const entry = { month, day, year: existing.year || null };
  col(client).set(key(guildId, userId), entry);
  return entry;
}

/** 移除生日；成功回傳 true */
async function remove(client, guildId, userId) {
  return col(client).delete(key(guildId, userId));
}

/** 列出伺服器所有生日（依月日排序），元素 { userId, month, day, year } */
async function list(client, guildId) {
  const prefix = `${guildId}:`;
  return col(client)
    .all()
    .filter((e) => e.id.startsWith(prefix) && typeof e.month === 'number' && typeof e.day === 'number')
    .map((e) => ({ userId: e.id.slice(prefix.length), month: e.month, day: e.day, year: e.year || null }))
    .sort((a, b) => a.month - b.month || a.day - b.day);
}

/** 檢查所有伺服器並公告當天生日者 */
async function checkBirthdays(client) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const p = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${p(month)}-${p(day)}`;

  for (const guild of client.guilds.cache.values()) {
    try {
      const s = await client.settings.get(guild.id);
      if (!s.birthdays.channel) continue;
      const prefix = `${guild.id}:`;
      const today = col(client)
        .all()
        .filter((e) => e.id.startsWith(prefix) && e.month === month && e.day === day);

      for (const entry of today) {
        const userId = entry.id.slice(prefix.length);
        const dedupeKey = `${guild.id}:${userId}:${dateStr}`;
        if (sentToday.has(dedupeKey)) continue;
        sentToday.set(dedupeKey, dateStr);

        // 公告頻道
        try {
          const channel = await guild.channels.fetch(s.birthdays.channel).catch(() => null);
          if (channel && channel.isTextBased()) {
            await channel.send(t(`🎂 <@${userId}> 生日快樂！`, `🎂 Happy birthday, <@${userId}>!`));
          }
        } catch (e) {
          logger.warn('birthdays', `生日公告失敗（${guild.id}/${userId}）：${e.message}`);
        }

        // 生日身分組
        if (s.birthdays.role) {
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) await member.roles.add(s.birthdays.role);
          } catch (e) {
            logger.warn('birthdays', `指派生日身分組失敗（${guild.id}/${userId}）：${e.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('birthdays', `處理伺服器 ${guild.id} 失敗：${e.message}`);
    }
  }

  // 清理非今天的紀錄，避免 Map 無限增長
  if (sentToday.size > 5000) {
    for (const [k, v] of sentToday) {
      if (v !== dateStr) sentToday.delete(k);
    }
  }
}

/** 開機初始化：立即檢查一次，之後每 60 分鐘檢查一次 */
async function onReady(client) {
  try {
    checkBirthdays(client).catch((e) => logger.error('birthdays', `檢查失敗：${e.message}`));
    setInterval(() => {
      checkBirthdays(client).catch((e) => logger.error('birthdays', `檢查失敗：${e.message}`));
    }, 60 * 60 * 1000);
  } catch (e) {
    logger.error('birthdays', `onReady 失敗：${e.message}`);
  }
}

module.exports = { set, remove, list, onReady };
