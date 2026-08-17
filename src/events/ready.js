const { logger } = require('../utils/logger');

/** 需要呼叫 onReady 的功能模組（依序初始化） */
const READY_HOOKS = [
  'verification',
  'tickets',
  'giveaways',
  'reminders',
  'birthdays',
  'stats',
  'tempVoice',
  'leveling',
  'economy',
  'music',
  'guide',
];

module.exports = {
  name: 'clientReady',
  once: true,
  async run(client) {
    client.ready = true;
    logger.info('ready', `已登入為 ${client.user.tag}（ID: ${client.user.id}）`);
    logger.info('ready', `目前伺服器數：${client.guilds.cache.size}，快取使用者數：${client.users.cache.size}`);

    // 狀態輪播
    let idx = 0;
    const setActivity = () => {
      const acts = client.config.presenceActivities;
      if (!acts || acts.length === 0) return;
      const a = acts[idx % acts.length];
      try {
        client.user.setActivity(a.name, { type: a.type });
      } catch (e) {
        logger.warn('ready', `設定狀態失敗：${e.message}`);
      }
      idx += 1;
    };
    setActivity();
    setInterval(setActivity, client.config.presenceIntervalMs);

    // 註冊斜線指令
    if (client.config.registerOnStart) {
      const { registerCommands } = require('../core/commandHandler');
      await registerCommands(client);
    }

    // 各功能模組初始化
    for (const name of READY_HOOKS) {
      try {
        const mod = require(`../features/${name}`);
        if (typeof mod.onReady === 'function') await mod.onReady(client);
      } catch (e) {
        logger.warn('ready', `${name}.onReady 略過：${e.message}`);
      }
    }

    logger.info('ready', '所有初始化完成，機器人開始運作！');
  },
};
