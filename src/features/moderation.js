/** 管理功能核心：警告紀錄 + 管理動作日誌 */
const { info, withFooter } = require('../utils/embeds');
const { discordTimestamp } = require('../utils/format');
const { logger } = require('../utils/logger');
const { t } = require('../utils/i18n');

/**
 * 新增警告紀錄（鍵：guildId:userId，值：{ count, cases: [{id, modId, reason, date}] }）
 * @returns {Promise<object>} 新增的 case 物件
 */
async function addWarn(client, guildId, userId, modId, reason) {
  const col = client.db.collection('warns');
  const key = `${guildId}:${userId}`;
  const caseObj = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    modId,
    reason: reason || t('（未提供原因）', '(no reason provided)'),
    date: new Date().toISOString(),
  };
  col.update(
    key,
    (cur) => {
      const data = cur && Array.isArray(cur.cases) ? cur : { count: 0, cases: [] };
      data.cases.push(caseObj);
      data.count = data.cases.length;
      return data;
    },
    { count: 0, cases: [] }
  );
  return caseObj;
}

/**
 * 移除指定警告案例
 * @returns {Promise<boolean>} 是否成功移除
 */
async function removeWarn(client, guildId, userId, caseId) {
  const col = client.db.collection('warns');
  const key = `${guildId}:${userId}`;
  const data = col.get(key);
  if (!data || !Array.isArray(data.cases)) return false;
  const idx = data.cases.findIndex((c) => c && String(c.id) === String(caseId));
  if (idx === -1) return false;
  data.cases.splice(idx, 1);
  data.count = data.cases.length;
  if (data.cases.length === 0) col.delete(key);
  else col.set(key, data);
  return true;
}

/** 取得使用者的所有警告案例（空陣列若無） */
async function getWarns(client, guildId, userId) {
  const data = client.db.collection('warns').get(`${guildId}:${userId}`);
  return data && Array.isArray(data.cases) ? data.cases : [];
}

/** 清除使用者的所有警告紀錄 */
async function clearWarns(client, guildId, userId) {
  const col = client.db.collection('warns');
  const key = `${guildId}:${userId}`;
  const data = col.get(key);
  const count = data && Array.isArray(data.cases) ? data.cases.length : 0;
  if (count > 0) col.delete(key);
  return count;
}

/** 將目標轉為可顯示的名稱 */
function describeTarget(target) {
  if (!target) return { name: t('未知', 'Unknown'), id: '—' };
  const user = target.user || target;
  const name = user.tag || user.username || target.name || t('未知', 'Unknown');
  return { name: String(name), id: String(target.id || '—') };
}

/** 將執行人轉為可顯示的字串 */
function describeMod(mod) {
  if (!mod) return t('未知', 'Unknown');
  const user = mod.user || mod;
  return t(
    `${user.tag || user.username || t('未知', 'Unknown')}（\`${mod.id || '—'}\`）`,
    `${user.tag || user.username || t('未知', 'Unknown')} (\`${mod.id || '—'}\`)`
  );
}

/**
 * 發送管理動作日誌（優先 modlogChannel，否則 logs.channel）
 * 全部 try/catch，失敗靜默。
 */
async function logModAction(client, guild, action, target, mod, reason) {
  try {
    if (!guild) return;
    const s = await client.settings.get(guild.id);
    const channelId = s.modlogChannel || (s.logs && s.logs.channel) || null;
    if (!channelId) return;
    let channel = guild.channels.cache.get(channelId);
    if (!channel) channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const targetInfo = describeTarget(target);
    const embed = info(t('🛡️ 管理動作', '🛡️ Moderation Action')).addFields(
      { name: t('動作', 'Action'), value: String(action), inline: true },
      { name: t('目標', 'Target'), value: t(`${targetInfo.name}（\`${targetInfo.id}\`）`, `${targetInfo.name} (\`${targetInfo.id}\`)`), inline: true },
      { name: t('執行人', 'Moderator'), value: describeMod(mod), inline: true },
      { name: t('原因', 'Reason'), value: reason || t('（未提供）', '(not provided)') },
      { name: t('時間', 'Time'), value: discordTimestamp(Date.now(), 'F') }
    );
    withFooter(embed, client, t('管理日誌', 'Moderation Log'));
    await channel.send({ embeds: [embed] });
  } catch (e) {
    logger.debug('moderation', `管理日誌發送失敗：${e.message}`);
  }
}

module.exports = { addWarn, removeWarn, getWarns, clearWarns, logModAction };
