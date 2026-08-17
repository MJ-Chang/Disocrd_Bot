/** 共用常數：顏色、表情、分類標籤 */

const Colors = {
  MAIN: 0x5865f2,
  INFO: 0x5865f2,
  SUCCESS: 0x57f287,
  ERROR: 0xed4245,
  WARN: 0xfee75c,
  LEVELING: 0xff73fa,
  ECONOMY: 0xffd700,
  TICKET: 0x00b0f4,
  MUSIC: 0x9b59b6,
  GIVEAWAY: 0xffac33,
  SUGGESTION: 0x7c6ff0,
  PURPLE: 0x9b59b6,
};

const Emojis = {
  check: '✅',
  cross: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  gift: '🎁',
  ticket: '🎫',
  music: '🎵',
  coin: '🪙',
  star: '⭐',
  ping: '🏓',
  shield: '🛡️',
  hammer: '🔨',
  pencil: '✏️',
  trash: '🗑️',
  lock: '🔒',
  unlock: '🔓',
  user: '👤',
  users: '👥',
  bell: '🔔',
  crown: '👑',
  chart: '📊',
  sparkles: '✨',
  fire: '🔥',
  snowflake: '❄️',
};

/** 指令分類標籤（用於 /help） */
const CategoryLabels = {
  moderation: '🛡️ 管理',
  config: '⚙️ 伺服器設定',
  utility: '🛠️ 實用工具',
  economy: '💰 經濟',
  leveling: '📈 等級',
  tickets: '🎫 客服表單',
  giveaways: '🎉 抽獎',
  suggestions: '💡 建議',
  fun: '🎮 娛樂',
  music: '🎵 音樂',
  voice: '🔊 語音',
};

const InviteRegex = /(discord\.(gg|io|me|li)\/[A-Za-z0-9]+|discord(app)?\.com\/invite\/[A-Za-z0-9]+)/gi;
const LinkRegex = /(https?:\/\/|www\.)[^\s]+/gi;
const MentionRegex = /<@!?&?\d+>/g;

module.exports = { Colors, Emojis, CategoryLabels, InviteRegex, LinkRegex, MentionRegex };
