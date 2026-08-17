const { logger } = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async run(client, oldState, newState) {
    const tasks = [
      ['tempVoice', 'handleVoiceState'], // 臨時語音頻道
      ['logging', 'handleVoiceState'], // 語音日誌
      ['music', 'handleVoiceState'], // 音樂播放器清理
    ];
    for (const [name, fnName] of tasks) {
      try {
        const mod = require(`../features/${name}`);
        if (typeof mod[fnName] === 'function') await mod[fnName](client, oldState, newState);
      } catch (e) {
        // 音樂等模組可能因缺依賴而無法載入，靜默略過
        if (name !== 'music') logger.error(name, `voiceStateUpdate 處理失敗：${e.message}`);
      }
    }
  },
};
