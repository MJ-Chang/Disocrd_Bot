/** 等級系統功能模組 */
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');
const { randomInt } = require('../utils/format');

const col = (client) => client.db.collection('levels');
const key = (guildId, userId) => `${guildId}:${userId}`;

/** 升級到某等級所需的總經驗：50 * level^2 */
function xpForLevel(level) {
  return 50 * level * level;
}

/** 依經驗值計算等級：floor(sqrt(xp / 50)) */
function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}

/**
 * 處理訊息：給予經驗值並處理升級（由 messageCreate 呼叫）。
 * 未啟用、頻道在 ignoreChannels、或未過冷卻（leveling.cooldown，預設 60 秒）時直接 return。
 */
async function handleMessage(client, message) {
  try {
    const guildId = message.guild.id;
    const s = await client.settings.get(guildId);
    if (!s.leveling.enabled) return;
    if (Array.isArray(s.leveling.ignoreChannels) && s.leveling.ignoreChannels.includes(message.channel.id)) return;

    const k = key(guildId, message.author.id);
    const profile = col(client).get(k) || { xp: 0, level: 0, lastMessage: 0 };
    const cooldown = s.leveling.cooldown ?? 60000;
    if (Date.now() - (profile.lastMessage || 0) < cooldown) return;

    profile.lastMessage = Date.now();
    profile.xp = (profile.xp || 0) + (s.leveling.xpPerMessage ?? 15) + randomInt(0, 5);
    const oldLevel = profile.level || 0;
    const newLevel = levelFromXp(profile.xp);
    profile.level = newLevel;
    col(client).set(k, profile);

    if (newLevel <= oldLevel) return;

    // 升級身分組（leveling.roles[新等級]）
    const roleMap = s.leveling.roles || {};
    for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
      const roleId = roleMap[lv];
      if (!roleId) continue;
      try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (member) await member.roles.add(roleId);
      } catch (e) {
        logger.warn('leveling', `無法指派 ${lv} 級身分組（${message.author.id}）：${e.message}`);
      }
    }

    // 升級公告（leveling.channel 若有，否則 DM）
    if (!s.leveling.announce) return;
    const text = t(`🎉 ${message.author.toString()} 升到 **${newLevel} 級**！`, `🎉 ${message.author.toString()} leveled up to **level ${newLevel}**!`);
    try {
      if (s.leveling.channel) {
        const channel = await message.guild.channels.fetch(s.leveling.channel).catch(() => null);
        if (channel && channel.isTextBased()) {
          await channel.send(text);
        } else {
          await message.author.send(text).catch(() => {});
        }
      } else {
        await message.author.send(text);
      }
    } catch (e) {
      logger.warn('leveling', `升級公告失敗（${message.author.id}）：${e.message}`);
    }
  } catch (e) {
    logger.error('leveling', `handleMessage 失敗：${e.message}`);
  }
}

/** 取得排名資料：{ xp, level, nextLevelXp, progress }（progress 為 0~1） */
async function getRank(client, guildId, userId) {
  const profile = col(client).get(key(guildId, userId)) || { xp: 0, level: 0 };
  const xp = profile.xp || 0;
  const level = levelFromXp(xp);
  const nextLevelXp = xpForLevel(level + 1);
  const curLevelXp = xpForLevel(level);
  const progress = nextLevelXp > curLevelXp ? Math.min(1, (xp - curLevelXp) / (nextLevelXp - curLevelXp)) : 1;
  return { xp, level, nextLevelXp, progress };
}

module.exports = { handleMessage, getRank, xpForLevel, levelFromXp };
