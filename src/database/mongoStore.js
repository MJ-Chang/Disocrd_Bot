const dns = require('dns');
const { MongoClient } = require('mongodb');
const { logger } = require('../utils/logger');

/**
 * MongoDB 儲存後端：與 JSON Store 完全相同的同步 API（記憶體快取），
 * 資料以非同步防抖動方式寫入 MongoDB，讓既有功能程式碼完全不用改。
 *
 * 文件格式：{ _id: key, data: value }
 */

class MongoCollection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
    this.data = new Map(); // key -> value
    this.dirty = new Set(); // 待寫入的 key
    this.timer = null;
  }

  get(key) {
    return this.data.get(key);
  }

  has(key) {
    return this.data.has(key);
  }

  set(key, value) {
    this.data.set(key, value);
    this._touch(key);
    return value;
  }

  delete(key) {
    if (!this.data.has(key)) return false;
    this.data.delete(key);
    this._touch(key);
    return true;
  }

  update(key, fn, defaultValue) {
    const cur = this.data.has(key) ? this.data.get(key) : defaultValue;
    const next = fn(cur);
    this.data.set(key, next);
    this._touch(key);
    return next;
  }

  ensure(key, defaultValue) {
    if (!this.data.has(key)) {
      this.data.set(key, defaultValue);
      this._touch(key);
    }
    return this.data.get(key);
  }

  find(fn) {
    for (const [k, v] of this.data) {
      if (fn(v, k)) return v;
    }
    return undefined;
  }

  filter(fn) {
    const out = [];
    for (const [k, v] of this.data) {
      if (fn(v, k)) out.push(v);
    }
    return out;
  }

  all() {
    const out = [];
    for (const [k, v] of this.data) {
      out.push(v && typeof v === 'object' && !Array.isArray(v) ? { id: k, ...v } : { id: k, value: v });
    }
    return out;
  }

  keys() {
    return [...this.data.keys()];
  }

  size() {
    return this.data.size;
  }

  replaceAll(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('資料必須是物件');
    }
    const oldKeys = this.data.keys();
    this.data = new Map(Object.entries(obj));
    // 標記所有新 key 為待寫入
    for (const k of this.data.keys()) this.dirty.add(k);
    // 被移除的舊 key 也要標記（否則重載後舊資料會復活）
    for (const k of oldKeys) {
      if (!this.data.has(k)) this.dirty.add(k);
    }
    return this.size();
  }

  _touch(key) {
    this.dirty.add(key);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.persist(), 400);
  }

  /** 將待寫入的 key 同步到 MongoDB */
  async persist() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const keys = [...this.dirty];
    if (!keys.length) return;
    this.dirty.clear();
    const col = this.store.mongoDb.collection(this.name);
    for (const key of keys) {
      try {
        if (this.data.has(key)) {
          await col.updateOne({ _id: key }, { $set: { data: this.data.get(key) } }, { upsert: true });
        } else {
          await col.deleteOne({ _id: key });
        }
      } catch (e) {
        logger.error('db', `寫入 ${this.name}/${key} 失敗：${e.message}`);
        this.dirty.add(key); // 下次重試
      }
    }
  }

  /** 從 MongoDB 載入全部資料 */
  async load() {
    try {
      const col = this.store.mongoDb.collection(this.name);
      for await (const doc of col.find({})) {
        this.data.set(doc._id, doc.data);
      }
      logger.info('db', `已載入 collection ${this.name}（${this.data.size} 筆）`);
    } catch (e) {
      logger.error('db', `載入 ${this.name} 失敗：${e.message}`);
    }
  }
}

/** 從 mongodb+srv:// URI 取出主機名 */
function extractSrvHost(uri) {
  const m = /^mongodb\+srv:\/\/[^@]*@([^/]+)/.exec(uri) || /^mongodb\+srv:\/\/([^/]+)/.exec(uri);
  return m ? m[1] : null;
}

/**
 * Windows 上 Node.js 的 c-ares 解析器可能無法用系統 DNS 查詢 SRV 紀錄
 * （ECONNREFUSED），導致 mongodb+srv:// 連線失敗。此函式在連線前先測試 SRV，
 * 失敗則改用公共 DNS（8.8.8.8 / 1.1.1.1）重試。
 */
async function ensureDnsWorks(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) return;
  const host = extractSrvHost(uri);
  if (!host) return;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (e) {
    logger.warn('db', `系統 DNS 無法查詢 SRV（${e.code}），改用 8.8.8.8 / 1.1.1.1`);
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
      logger.info('db', '已切換 DNS 並成功解析 SRV');
    } catch (e2) {
      logger.error('db', `改用公共 DNS 仍無法解析 SRV：${e2.code || e2.message}`);
    }
  }
}

class MongoStore {
  constructor(uri, dbName) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = null;
    this.mongoDb = null;
    this.collections = new Map();
  }

  async init() {
    await ensureDnsWorks(this.uri);
    this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 8000 });
    await this.client.connect();
    this.mongoDb = this.client.db(this.dbName);
    const names = await this.mongoDb.listCollections().toArray();
    for (const info of names) {
      const col = this.collection(info.name);
      await col.load(); // 重要：載入既有資料，否則記憶體是空的，設定會被預設值覆寫
    }
    const masked = this.uri.replace(/\/\/[^@]+@/, '//***@');
    logger.info('db', `已連線 MongoDB（${masked}），載入 ${names.length} 個 collection`);
  }

  collection(name) {
    if (!this.collections.has(name)) {
      const col = new MongoCollection(this, name);
      this.collections.set(name, col);
      // init() 時已載入既有 collection；新建的 collection 直接從空開始
    }
    return this.collections.get(name);
  }

  listCollections() {
    const out = [];
    for (const [name, col] of this.collections) {
      out.push({ name, size: col.size() });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async flush() {
    for (const col of this.collections.values()) {
      await col.persist();
    }
  }

  async close() {
    try {
      await this.flush();
      if (this.client) await this.client.close();
    } catch (e) {
      logger.error('db', `關閉 MongoDB 連線失敗：${e.message}`);
    }
  }
}

module.exports = { MongoStore, ensureDnsWorks };
