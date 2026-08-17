/** 格式化與解析工具 */

const UNITS = { w: 7 * 864e5, d: 864e5, h: 36e5, m: 6e4, s: 1e3 };

/**
 * 解析持續時間字串，例如 "1d2h30m"、"30m"、"90"（秒）
 * @returns {number|null} 毫秒
 */
function parseDuration(input) {
  if (typeof input !== 'string') return null;
  const str = input.trim().toLowerCase();
  if (!str) return null;
  const asNumber = Number(str);
  if (!Number.isNaN(asNumber) && str === String(asNumber)) return asNumber * 1000;
  const re = /(\d+(?:\.\d+)?)\s*(ms|w|d|h|m|s)/g;
  let total = 0;
  let match;
  let any = false;
  while ((match = re.exec(str))) {
    any = true;
    const value = parseFloat(match[1]);
    const unit = match[2];
    total += unit === 'ms' ? value : value * UNITS[unit];
  }
  if (!any) return null;
  return total > 0 ? total : null;
}

/** 將毫秒格式化成人類可讀文字 */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0 秒';
  if (ms < 1000) return `${Math.round(ms)} 毫秒`;
  const totalS = Math.floor(ms / 1000);
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const parts = [];
  if (d) parts.push(`${d} 天`);
  if (h) parts.push(`${h} 小時`);
  if (m) parts.push(`${m} 分`);
  if (s) parts.push(`${s} 秒`);
  return parts.join(' ').slice(0, 60);
}

/** 將毫秒格式化成 HH:MM:SS */
function formatClock(ms) {
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** 千分位數字 */
function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

/** 精簡數字：12000 -> 12K */
function formatCompact(n) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}

/** 機器人運行時間 */
function formatUptime(ms) {
  return formatDuration(ms);
}

/** Discord 時間戳記 */
function discordTimestamp(ms, style = 'R') {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

/** 日期格式化 YYYY-MM-DD HH:MM */
function formatDateTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  parseDuration,
  formatDuration,
  formatClock,
  formatNumber,
  formatCompact,
  formatUptime,
  discordTimestamp,
  formatDateTime,
  chunk,
  randomInt,
  sample,
  escapeRegex,
};
