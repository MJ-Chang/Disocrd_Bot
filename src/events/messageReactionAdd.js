const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageReactionAdd',
  async run(client, reaction, user) {
    if (user.bot) return;
    try {
      await require('../features/reactionRoles').handleReactionAdd(client, reaction, user);
    } catch (e) {
      logger.error('messageReactionAdd', `反應處理失敗：${e.stack || e.message}`);
    }
  },
};
