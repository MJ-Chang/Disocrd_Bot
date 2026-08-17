const { logger } = require('../utils/logger');

module.exports = {
  name: 'guildDelete',
  async run(client, guild) {
    client.settings.drop(guild.id);
    logger.info('guild', `已離開伺服器：${guild.name}（${guild.id}）`);
  },
};
