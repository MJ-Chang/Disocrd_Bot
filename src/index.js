const config = require('./config');
const { logger } = require('./utils/logger');
const { createClient } = require('./core/client');
const { loadCommands } = require('./core/commandHandler');
const { loadEvents } = require('./core/eventHandler');

process.on('unhandledRejection', (reason) => {
  logger.error('process', `未處理的 Promise 拒絕：${reason?.stack || reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error('process', `未捕捉的例外：${err.stack || err}`);
});

/** 乾跑模式：載入所有模組、驗證後直接結束 */
async function dryRun(client) {
  logger.info('dry-run', '===== 乾跑模式：驗證模組載入 =====');
  logger.info('dry-run', `指令數：${client.commands.size}`);
  logger.info('dry-run', `事件數：${client._events ? Object.keys(client._events).length : 0}`);
  logger.info('dry-run', '所有模組載入成功 ✓');
  client.db.flush();
  logger.info('dry-run', '資料庫已刷新，結束。');
  process.exit(0);
}

async function main() {
  const client = createClient();

  await loadCommands(client);
  await loadEvents(client);

  if (config.isDryRun) {
    await dryRun(client);
    return;
  }

  if (!config.token) {
    logger.error('main', '找不到 TOKEN！請在 .env 中設定 TOKEN（參考 .env.example）。');
    process.exit(1);
  }

  // 優雅關閉
  const shutdown = async (signal) => {
    logger.info('main', `收到 ${signal}，正在儲存資料並關閉…`);
    client.db.flush();
    try {
      client.destroy();
    } catch (e) {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await client.login(config.token);
    logger.info('main', '機器人登入成功，等待事件…');
  } catch (e) {
    logger.error('main', `登入失敗：${e.message}`);
    // 常見錯誤：Privileged Intents 未開啟 → 給出明確解決步驟
    if (/disallowed intents/i.test(e.message || '')) {
      logger.error('main', '');
      logger.error('main', '══════════ 解決方法 ══════════');
      logger.error('main', '機器人要求的 Privileged Gateway Intents 未在開發者後台開啟：');
      logger.error('main', '  1. 開啟 https://discord.com/developers/applications');
      logger.error('main', '  2. 選擇你的應用程式 → 左側「Bot」分頁');
      logger.error('main', '  3. 在「Privileged Gateway Intents」開啟以下三個開關：');
      logger.error('main', '     ☐ SERVER MEMBERS INTENT    （成員事件：驗證/歡迎/自動身分組）');
      logger.error('main', '     ☐ MESSAGE CONTENT INTENT  （讀取訊息：自動審核/等級/AFK）');
      logger.error('main', '     ☐ PRESENCE INTENT         （線上狀態：統計頻道）');
      logger.error('main', '  4. 存檔後重新執行 npm start');
      logger.error('main', '');
      logger.error('main', '（若你不想用某個功能，也可在 .env 關閉對應 Intent：');
      logger.error('main', '   INTENT_MEMBERS=false / INTENT_MESSAGE_CONTENT=false / INTENT_PRESENCE=false）');
      logger.error('main', '══════════════════════════════');
    } else if (/invalid token/i.test(e.message || '')) {
      logger.error('main', '提示：請確認 .env 中的 TOKEN 是「Bot Token」（Developer Portal → Bot → Token），且沒有多餘空格。');
    }
    process.exit(1);
  }

  // 網頁控制面板（登入後啟動）
  if (config.panel.enabled) {
    try {
      const { createPanel } = require('./panel/server');
      const { app, token } = createPanel(client);
      app.listen(config.panel.port, config.panel.host, () => {
        logger.info('panel', `控制面板已啟動：http://${config.panel.host}:${config.panel.port}`);
        logger.info('panel', `控制面板 Token：${token}`);
      });
    } catch (e) {
      logger.error('panel', `控制面板啟動失敗：${e.message}`);
    }
  }
}

main();
