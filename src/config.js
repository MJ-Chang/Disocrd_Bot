const path = require('path');
require('dotenv').config();

const root = path.resolve(__dirname, '..');

/** 解析 HEX 顏色字串為十進位數字 */
function parseColor(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const n = parseInt(clean, 16);
  return Number.isNaN(n) ? 0x5865f2 : n;
}

const config = {
  root,
  /** Bot Token */
  token: process.env.TOKEN || '',
  /** 應用程式 Client ID */
  clientId: process.env.CLIENT_ID || '',
  /** 開發用：只註冊到這個伺服器 */
  guildId: process.env.GUILD_ID || '',
  /** 開機時是否註冊斜線指令 */
  registerOnStart: process.env.REGISTER_ON_START !== 'false',
  /** 主要嵌入顏色 */
  colorMain: parseColor(process.env.COLOR_MAIN || '5865F2'),
  /** 機器人擁有者 ID */
  ownerId: process.env.OWNER_ID || '',
  /** 資料目錄 */
  dataDir: path.resolve(root, process.env.DATA_DIR || './data'),
  /** 日誌等級 */
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
  /** 是否啟用音樂 */
  musicEnabled: process.env.MUSIC_ENABLED !== 'false',
  /** 訊息語言：both（中英雙語，預設）/ zh（僅中文）/ en（僅英文） */
  lang: (process.env.LANG || 'both').toLowerCase(),
  /** 資料庫類型：json（本地檔案，預設）/ mongodb（MongoDB Atlas 等） */
  dbType: (process.env.DB_TYPE || 'json').toLowerCase(),
  /** MongoDB 連線字串（DB_TYPE=mongodb 時必填） */
  mongodbUri: process.env.MONGODB_URI || '',
  /** MongoDB 資料庫名稱 */
  mongodbName: process.env.MONGODB_NAME || 'disocrd_bot',
  /** GitHub API Token（可選；未設定時有每小時 60 次的速率限制） */
  githubToken: process.env.GITHUB_TOKEN || '',
  /** GitHub 更新通知檢查間隔（分鐘，最小 1） */
  githubCheckIntervalMin: Math.max(1, parseInt(process.env.GITHUB_CHECK_INTERVAL || '10', 10) || 10),
  /** Privileged Intents 開關（對應開發者後台的三個開關；設 false 可略過） */
  intents: {
    members: process.env.INTENT_MEMBERS !== 'false',
    messageContent: process.env.INTENT_MESSAGE_CONTENT !== 'false',
    presence: process.env.INTENT_PRESENCE !== 'false',
  },
  /** 網頁控制面板 */
  panel: {
    enabled: process.env.PANEL_ENABLED !== 'false',
    host: process.env.PANEL_HOST || '127.0.0.1',
    port: parseInt(process.env.PANEL_PORT || '3000', 10),
    token: process.env.PANEL_TOKEN || '',
  },
  /** 乾跑模式：載入所有模組但不登入 */
  isDryRun: process.argv.includes('--dry'),
  /** 機器人狀態輪播（type: 0=Playing, 2=Listening, 3=Watching, 5=Competing） */
  presenceActivities: [
    { name: '/help 查看指令', type: 3 },
    { name: '伺服器管理', type: 5 },
    { name: '陪你聊天', type: 0 },
    { name: '音樂播放中', type: 2 },
  ],
  presenceIntervalMs: 60 * 1000,
};

module.exports = config;
