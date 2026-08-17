const { logger } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async run(client, member) {
    try {
      await require('../features/welcome').onGuildMemberRemove(client, member);
    } catch (e) {
      logger.error('guildMemberRemove', `歡送處理失敗：${e.stack || e.message}`);
    }
  },
};
