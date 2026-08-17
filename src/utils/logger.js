const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 即時日誌訂閱（供網頁控制面板使用） */
const subscribers = new Set();
const history = []; // 最近 500 筆

/** 訂閱日誌串流，回傳取消訂閱函式 */
function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** 取得歷史日誌 */
function getHistory() {
  return [...history];
}

function emit(entry) {
  history.push(entry);
  if (history.length > 500) history.shift();
  for (const fn of subscribers) {
    try {
      fn(entry);
    } catch (e) {
      /* 訂閱者錯誤不影響日誌 */
    }
  }
}

function write(level, tag, args) {
  const threshold = LEVELS[config.logLevel] ?? LEVELS.info;
  if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
  const color = COLORS[level] || COLORS.info;
  const msg = args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack || ''}` : typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
    .join(' ');
  // eslint-disable-next-line no-console
  console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${color}[${level.toUpperCase()}]${COLORS.reset} ${COLORS.dim}${tag}${COLORS.reset} ${msg}`);
  emit({ ts: Date.now(), time: ts(), level, tag, msg });
}

const logger = {
  debug: (tag, ...args) => write('debug', tag, args),
  info: (tag, ...args) => write('info', tag, args),
  warn: (tag, ...args) => write('warn', tag, args),
  error: (tag, ...args) => write('error', tag, args),
};

module.exports = { logger, subscribe, getHistory };
