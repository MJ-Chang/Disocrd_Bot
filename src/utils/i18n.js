const config = require('../config');

/** 語言模式：both（中英雙語，預設）/ zh（僅中文）/ en（僅英文） */
const LANG = ['zh', 'en', 'both'].includes(config.lang) ? config.lang : 'both';

/**
 * 雙語文字助手：t('中文', 'English')
 * - both：回傳「中文 | English」
 * - zh：只回傳中文
 * - en：只回傳英文
 * 第二參數省略時一律回傳中文（未翻譯的字串）。
 */
function t(zh, en) {
  if (!en) return zh;
  if (LANG === 'en') return en;
  if (LANG === 'zh') return zh;
  return `${zh} | ${en}`;
}

module.exports = { t, LANG };
