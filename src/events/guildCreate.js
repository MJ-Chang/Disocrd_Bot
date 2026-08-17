const { logger } = require('../utils/logger');

module.exports = {
  name: 'guildCreate',
  async run(client, guild) {
    try {
      await client.settings.ensure(guild.id);
      logger.info('guild', `加入新伺服器：${guild.name}（${guild.id}，成員 ${guild.memberCount}）`);
    } catch (e) {
      logger.error('guild', `初始化 ${guild.id} 設定失敗：${e.message}`);
    }
  },
};
