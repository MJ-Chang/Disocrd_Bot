const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageReactionRemove',
  async run(client, reaction, user) {
    if (user.bot) return;
    try {
      await require('../features/reactionRoles').handleReactionRemove(client, reaction, user);
    } catch (e) {
      logger.error('messageReactionRemove', `移除反應處理失敗：${e.stack || e.message}`);
    }
  },
};
