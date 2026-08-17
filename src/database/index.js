const fs = require('fs');
const path = require('path');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * 極簡 JSON 資料庫：每個 Collection 對應 data 目錄下一個 JSON 檔。
 * 內建記憶體快取 + 防抖動原子寫入，足夠中小型伺服器使用。
 */
class Collection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
    this.filePath = path.join(store.dir, `${name}.json`);
    this.data = {};
    this.dirty = false;
    this.timer = null;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      logger.warn('db', `讀取 ${this.name} 失敗，改用空資料：${e.message}`);
      this.data = {};
    }
  }

  _scheduleSave() {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.persist(), 400);
  }

  persist() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      fs.mkdirSync(this.store.dir, { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.filePath);
    } catch (e) {
      logger.error('db', `寫入 ${this.name} 失敗：${e.message}`);
    }
  }

  get(key) {
    return this.data[key];
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  set(key, value) {
    this.data[key] = value;
    this._scheduleSave();
    return value;
  }

  delete(key) {
    if (!this.has(key)) return false;
    delete this.data[key];
    this._scheduleSave();
    return true;
  }

  /** 若不存在則以預設值建立 */
  ensure(key, defaultValue) {
    if (!this.has(key)) {
      this.data[key] = defaultValue;
      this._scheduleSave();
    }
    return this.data[key];
  }

  /** 以函式更新：update(key, (cur)=>next, defaultValue) */
  update(key, fn, defaultValue) {
    const cur = this.has(key) ? this.data[key] : defaultValue;
    const next = fn(cur);
    this.data[key] = next;
    this._scheduleSave();
    return next;
  }

  /** 以完整物件取代整個 collection（供控制面板還原使用） */
  replaceAll(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('資料必須是物件');
    }
    this.data = obj;
    this._scheduleSave();
    return this.size();
  }

  find(fn) {
    for (const k of Object.keys(this.data)) {
      if (fn(this.data[k], k)) return this.data[k];
    }
    return undefined;
  }

  filter(fn) {
    const out = [];
    for (const k of Object.keys(this.data)) {
      if (fn(this.data[k], k)) out.push(this.data[k]);
    }
    return out;
  }

  /** 回傳 [{ id, ...value }] */
  all() {
    return Object.entries(this.data).map(([id, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? { id, ...v } : { id, value: v }
    );
  }

  keys() {
    return Object.keys(this.data);
  }

  size() {
    return Object.keys(this.data).length;
  }

  flush() {
    this.persist();
  }
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Collection(this, name));
    }
    return this.collections.get(name);
  }

  /** 列出所有 collection 名稱與筆數（供控制面板使用） */
  listCollections() {
    const out = [];
    for (const [name, col] of this.collections) {
      out.push({ name, size: col.size() });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  flush() {
    for (const c of this.collections.values()) c.persist();
  }
}

module.exports = new Store(config.dataDir);
