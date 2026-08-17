const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('../config');
const db = require('../database');
const { GuildSettings } = require('./settings');
const { Cooldowns } = require('./cooldowns');
const { logger } = require('../utils/logger');

/** 建立並初始化 Discord Client */
function createClient() {
  // Privileged Intents：依設定組合（未開啟的 Intent 會導致 Discord 拒絕連線）
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ];
  if (config.intents.members) intents.push(GatewayIntentBits.GuildMembers);
  if (config.intents.messageContent) intents.push(GatewayIntentBits.MessageContent);
  if (config.intents.presence) intents.push(GatewayIntentBits.GuildPresences);

  if (!config.intents.members) logger.warn('client', 'INTENT_MEMBERS=false：成員事件（驗證/歡迎/自動身分組）將無法運作');
  if (!config.intents.messageContent) logger.warn('client', 'INTENT_MESSAGE_CONTENT=false：自動審核/等級/AFK 將無法讀取訊息內容');
  if (!config.intents.presence) logger.warn('client', 'INTENT_PRESENCE=false：線上人數統計將顯示 0');

  const client = new Client({
    intents,
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
      Partials.User,
      Partials.MessageReaction,
    ],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
  });

  client.config = config;
  client.db = db;
  client.commands = new Collection();
  client.cooldowns = new Cooldowns();
  client.settings = new GuildSettings(client);
  client.startedAt = Date.now();
  client.ready = false;

  // 全域錯誤處理
  client.on('error', (e) => logger.error('client', `WebSocket 錯誤：${e.message}`));
  client.on('warn', (w) => logger.warn('client', String(w)));

  logger.info('client', 'Client 建立完成');
  return client;
}

module.exports = { createClient };
