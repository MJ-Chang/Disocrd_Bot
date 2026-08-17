const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * 載入所有事件。
 * 每個事件檔 export：
 *  - name: discord.js 事件名稱（例如 'clientReady'）
 *  - once: 是否只執行一次（可選）
 *  - run(client, ...args): async
 */
async function loadEvents(client) {
  const dir = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(dir)) {
    logger.warn('events', '找不到事件目錄');
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      const name = mod.name || file.replace('.js', '');
      const run = mod.run;
      if (typeof run !== 'function') {
        logger.warn('events', `${file} 缺少 run 函式，已略過`);
        continue;
      }
      if (mod.once) {
        client.once(name, (...args) => run(client, ...args).catch((e) => logger.error('events', `${name} 事件錯誤：${e.message}\n${e.stack || ''}`)));
      } else {
        client.on(name, (...args) => run(client, ...args).catch((e) => logger.error('events', `${name} 事件錯誤：${e.message}\n${e.stack || ''}`)));
      }
    } catch (e) {
      logger.error('events', `載入 ${file} 失敗：${e.message}\n${e.stack || ''}`);
    }
  }
  logger.info('events', `已載入 ${files.length} 個事件`);
}

module.exports = { loadEvents };
