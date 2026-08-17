const { DEFAULTS } = require('../database/defaults');
const { logger } = require('../utils/logger');

/** 深層合併（後者覆蓋前者） */
function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    const bv = base[key];
    const ov = override[key];
    if (bv && ov && typeof bv === 'object' && !Array.isArray(bv) && typeof ov === 'object' && !Array.isArray(ov)) {
      out[key] = deepMerge(bv, ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}

/** 以點路徑設定巢狀值：setPath(obj, 'a.b.c', v) */
function setPath(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

/** 以點路徑取得巢狀值 */
function getPath(obj, path, fallback) {
  const parts = String(path).split('.');
  let cur = obj;
  for (const key of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[key];
  }
  return cur === undefined ? fallback : cur;
}

/**
 * 每個伺服器的設定管理：快取 + JSON 持久化
 */
class GuildSettings {
  constructor(client) {
    this.client = client;
    this.cache = new Map();
  }

  col() {
    return this.client.db.collection('guilds');
  }

  /** 取得（必要時建立）伺服器設定 */
  async ensure(guildId) {
    if (this.cache.has(guildId)) return this.cache.get(guildId);
    const raw = this.col().get(guildId);
    const merged = raw ? deepMerge(structuredClone(DEFAULTS), raw) : structuredClone(DEFAULTS);
    this.col().set(guildId, merged);
    this.cache.set(guildId, merged);
    return merged;
  }

  /** 取得設定（單一來源，含快取） */
  async get(guildId) {
    return this.ensure(guildId);
  }

  /** 設定單一欄位（支援點路徑） */
  async set(guildId, path, value) {
    const s = await this.ensure(guildId);
    setPath(s, path, value);
    this.col().set(guildId, s);
    return s;
  }

  /** 以函式更新整個設定物件 */
  async update(guildId, fn) {
    const s = await this.ensure(guildId);
    fn(s);
    this.col().set(guildId, s);
    return s;
  }

  /** 取得單一欄位 */
  async getPath(guildId, path, fallback) {
    const s = await this.ensure(guildId);
    return getPath(s, path, fallback);
  }

  /** 重設為預設值 */
  async reset(guildId) {
    const def = structuredClone(DEFAULTS);
    this.cache.set(guildId, def);
    this.col().set(guildId, def);
    logger.info('settings', `已重設 ${guildId} 的設定`);
    return def;
  }

  /** 以完整物件取代設定（與預設值深層合併，供控制面板使用） */
  async replace(guildId, obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('設定必須是物件');
    }
    const merged = deepMerge(structuredClone(DEFAULTS), obj);
    this.cache.set(guildId, merged);
    this.col().set(guildId, merged);
    return merged;
  }

  /** 清除快取（例如離開伺服器時） */
  drop(guildId) {
    this.cache.delete(guildId);
  }
}

module.exports = { GuildSettings, deepMerge, setPath, getPath };
