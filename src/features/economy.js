/** 經濟系統功能模組 */
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');
const { randomInt } = require('../utils/format');

const col = (client) => client.db.collection('economy');
const key = (guildId, userId) => `${guildId}:${userId}`;

const DEFAULT_PROFILE = () => ({
  wallet: 0,
  lastDaily: 0,
  lastWork: 0,
  lastBeg: 0,
  lastWeekly: 0,
  dailyStreak: 0,
});

/** UTC 日期字串（YYYY-MM-DD） */
function utcDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 取得（必要時建立）經濟資料 */
async function getProfile(client, guildId, userId) {
  const k = key(guildId, userId);
  const existing = col(client).get(k);
  if (existing && typeof existing === 'object') return { ...DEFAULT_PROFILE(), ...existing };
  const profile = DEFAULT_PROFILE();
  col(client).set(k, profile);
  return profile;
}

/** 增加（可負數）金錢；餘額不足回傳 false */
async function addMoney(client, guildId, userId, amount) {
  try {
    const profile = await getProfile(client, guildId, userId);
    const next = (profile.wallet || 0) + amount;
    if (next < 0) return false;
    profile.wallet = next;
    col(client).set(key(guildId, userId), profile);
    return true;
  } catch (e) {
    logger.error('economy', `addMoney 失敗：${e.message}`);
    return false;
  }
}

/** 設定金錢（不可為負） */
async function setMoney(client, guildId, userId, amount) {
  try {
    const profile = await getProfile(client, guildId, userId);
    profile.wallet = Math.max(0, Math.floor(amount));
    col(client).set(key(guildId, userId), profile);
    return profile.wallet;
  } catch (e) {
    logger.error('economy', `setMoney 失敗：${e.message}`);
    return 0;
  }
}

/**
 * 每日獎勵（依設定 economy.daily，預設 500）。
 * 以 UTC 日期字串 'YYYY-MM-DD' 判斷是否今天已領。
 * 成功回傳 { amount, streak? }；冷卻中（今天已領）回傳 null。
 */
async function daily(client, guildId, userId) {
  const s = await client.settings.get(guildId);
  const amount = s.economy.daily ?? 500;
  const profile = await getProfile(client, guildId, userId);
  const today = utcDateStr();
  if (profile.lastDaily === today) return null;
  const yesterday = utcDateStr(new Date(Date.now() - 864e5));
  const streak = profile.lastDaily === yesterday ? (profile.dailyStreak || 0) + 1 : 1;
  profile.lastDaily = today;
  profile.dailyStreak = streak;
  profile.wallet = (profile.wallet || 0) + amount;
  col(client).set(key(guildId, userId), profile);
  return streak > 1 ? { amount, streak } : { amount };
}

/**
 * 每週獎勵（依設定 economy.weekly，預設 2500）。
 * 以「距上次領取是否超過 7 天」判斷；冷卻中回傳 null。
 */
async function weekly(client, guildId, userId) {
  const s = await client.settings.get(guildId);
  const amount = s.economy.weekly ?? 2500;
  const profile = await getProfile(client, guildId, userId);
  const last = profile.lastWeekly || 0;
  if (Date.now() - last < 7 * 864e5) return null;
  profile.lastWeekly = Date.now();
  profile.wallet = (profile.wallet || 0) + amount;
  col(client).set(key(guildId, userId), profile);
  return { amount };
}

/**
 * 打工（隨機 economy.workMin..workMax，預設 100..300）。
 * 冷卻 economy.workCooldown（預設 1 小時）；冷卻中回傳 { cooldown }。
 */
async function work(client, guildId, userId) {
  const s = await client.settings.get(guildId);
  const min = s.economy.workMin ?? 100;
  const max = s.economy.workMax ?? 300;
  const cooldownMs = s.economy.workCooldown ?? 3600000;
  const profile = await getProfile(client, guildId, userId);
  const last = profile.lastWork || 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldownMs) return { cooldown: cooldownMs - elapsed };
  const amount = randomInt(min, max);
  profile.lastWork = Date.now();
  profile.wallet = (profile.wallet || 0) + amount;
  col(client).set(key(guildId, userId), profile);
  return { amount };
}

/**
 * 乞討（隨機 economy.begMin..begMax，預設 1..30）。
 * 冷卻 economy.begCooldown（預設 45 秒）；冷卻中回傳 { cooldown }。
 */
async function beg(client, guildId, userId) {
  const s = await client.settings.get(guildId);
  const min = s.economy.begMin ?? 1;
  const max = s.economy.begMax ?? 30;
  const cooldownMs = s.economy.begCooldown ?? 45000;
  const profile = await getProfile(client, guildId, userId);
  const last = profile.lastBeg || 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldownMs) return { cooldown: cooldownMs - elapsed };
  const amount = randomInt(min, max);
  profile.lastBeg = Date.now();
  profile.wallet = (profile.wallet || 0) + amount;
  col(client).set(key(guildId, userId), profile);
  return { amount };
}

/** 取得商店商品清單（元素 { id, name, price, description, roleId }） */
async function getShop(client, guildId) {
  const s = await client.settings.get(guildId);
  return Array.isArray(s.economy.shop) ? s.economy.shop : [];
}

/**
 * 購買商品。
 * 成功扣款並回傳 { ok: true, item }；失敗回傳 { ok: false, reason }。
 * roleId 商品：指派身分組（try/catch，失敗回 reason）。
 * 一般商品：存入 collection 'inventory'（鍵同 economy，值 { items: {} }）。
 */
async function buy(client, guildId, userId, itemId) {
  try {
    const shop = await getShop(client, guildId);
    const item = shop.find((i) => String(i.id) === String(itemId));
    if (!item) return { ok: false, reason: t('找不到該商品。', 'Item not found.') };
    const profile = await getProfile(client, guildId, userId);
    if ((profile.wallet || 0) < item.price) return { ok: false, reason: t('餘額不足。', 'Insufficient balance.') };

    if (item.roleId) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { ok: false, reason: t('找不到伺服器。', 'Guild not found.') };
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return { ok: false, reason: t('找不到該成員。', 'Member not found.') };
        await member.roles.add(item.roleId);
      } catch (e) {
        logger.warn('economy', `購買身分組商品失敗（${itemId}）：${e.message}`);
        return { ok: false, reason: t('無法指派身分組（角色不存在或機器人權限不足）。', 'Could not assign the role (missing role or bot permissions).') };
      }
    } else {
      const inv = client.db.collection('inventory');
      inv.update(key(guildId, userId), (cur) => {
        const items = (cur && cur.items) || {};
        items[String(item.id)] = (items[String(item.id)] || 0) + 1;
        return { items };
      }, { items: {} });
    }

    profile.wallet -= item.price;
    col(client).set(key(guildId, userId), profile);
    return { ok: true, item };
  } catch (e) {
    logger.error('economy', `buy 失敗：${e.message}`);
    return { ok: false, reason: t('購買失敗，請稍後再試。', 'Purchase failed, please try again later.') };
  }
}

module.exports = { getProfile, addMoney, setMoney, daily, weekly, work, beg, getShop, buy };
