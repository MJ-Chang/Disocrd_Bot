const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async run(client, message) {
    // 忽略機器人與 DM
    if (!message.guild || message.author.bot) return;

    // 1. 自動審核 + 反垃圾（被處罰的訊息不繼續處理）
    try {
      const automod = require('../features/automod');
      const result = await automod.checkMessage(client, message);
      if (result) {
        await automod.executeAction(client, message, result.action, result.reason);
        return;
      }
    } catch (e) {
      logger.error('automod', `檢查訊息失敗：${e.message}`);
    }

    // 2. 等級系統（經驗值）
    try {
      await require('../features/leveling').handleMessage(client, message);
    } catch (e) {
      logger.error('leveling', `等級處理失敗：${e.message}`);
    }

    // 3. AFK 系統（清除自己的 AFK、提醒提及者）
    try {
      await require('../features/afk').handleMessage(client, message);
    } catch (e) {
      logger.error('afk', `AFK 處理失敗：${e.message}`);
    }
  },
};
