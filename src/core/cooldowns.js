/**
 * 指令冷卻系統：以「使用者ID:指令名」為鍵
 */
class Cooldowns {
  constructor() {
    this.map = new Map();
  }

  key(userId, commandName) {
    return `${userId}:${commandName}`;
  }

  /** 剩餘冷卻毫秒；0 代表可用 */
  remaining(userId, commandName) {
    const key = this.key(userId, commandName);
    const until = this.map.get(key);
    if (!until) return 0;
    const diff = until - Date.now();
    return diff > 0 ? diff : 0;
  }

  set(userId, commandName, ms) {
    const key = this.key(userId, commandName);
    this.map.set(key, Date.now() + ms);
    // 節流清理，避免 Map 無限增長
    if (this.map.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.map) {
        if (v <= now) this.map.delete(k);
      }
    }
  }
}

module.exports = { Cooldowns };
