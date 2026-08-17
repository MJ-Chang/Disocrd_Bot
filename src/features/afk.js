const { logger } = require('../utils/logger');
const { t } = require('../utils/i18n');

/**
 * 設定使用者的 AFK 狀態。
 * 資料結構：client.db.collection('afk')，鍵 = 用戶 ID，值 = { guildId, reason, at }
 * @param {import('discord.js').Client} client
 * @param {string} userId 用戶 ID
 * @param {string} guildId 伺服器 ID
 * @param {string} [reason] AFK 原因
 * @returns {Promise<boolean>} 是否成功
 */
async function setAFK(client, userId, guildId, reason) {
  try {
    const col = client.db.collection('afk');
    col.set(String(userId), {
      guildId: String(guildId),
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : '',
      at: Date.now(),
    });
    return true;
  } catch (e) {
    logger.error('afk', `設定 AFK 失敗：${e.message}`);
    return false;
  }
}

/**
 * 處理訊息：
 *  (a) 發言者自己若在 AFK 資料中 → 刪除並回覆「歡迎回來」；
 *  (b) 若有提及的成員處於 AFK → 回覆提醒。
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 */
async function handleMessage(client, message) {
  try {
    const col = client.db.collection('afk');

    // (a) 發言者自己若在 AFK 狀態 → 移除並歡迎回來
    const self = col.get(message.author.id);
    if (self) {
      col.delete(message.author.id);
      const reasonPart = self.reason ? '\n' + t(`📝 你的 AFK 原因：${self.reason}`, `📝 Your AFK reason: ${self.reason}`) : '';
      await message
        .reply(t(`👋 歡迎回來！已移除你的 AFK 狀態。${reasonPart}`, `👋 Welcome back! Your AFK status has been removed.${reasonPart}`))
        .catch(() => {});
    }

    // (b) 檢查提及的成員是否有 AFK 狀態
    if (message.mentions.members && message.mentions.members.size > 0) {
      for (const [, member] of message.mentions.members) {
        if (member.id === message.author.id) continue; // 自己不算
        const afk = col.get(member.id);
        if (afk) {
          await message
            .reply(t(
              `💤 <@${member.id}> 目前 AFK：${afk.reason || t('（未填寫原因）', 'No reason given')}`,
              `💤 <@${member.id}> is currently AFK: ${afk.reason || t('（未填寫原因）', 'No reason given')}`
            ))
            .catch(() => {});
        }
      }
    }
  } catch (e) {
    logger.error('afk', `處理訊息失敗：${e.message}`);
  }
}

module.exports = { setAFK, handleMessage };
