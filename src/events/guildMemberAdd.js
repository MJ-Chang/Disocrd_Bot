const { logger } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async run(client, member) {
    try {
      await require('../features/welcome').onGuildMemberAdd(client, member);
    } catch (e) {
      logger.error('guildMemberAdd', `歡迎處理失敗：${e.stack || e.message}`);
    }
    try {
      await require('../features/verification').onGuildMemberAdd(client, member);
    } catch (e) {
      logger.error('guildMemberAdd', `驗證身分組處理失敗：${e.stack || e.message}`);
    }
  },
};
