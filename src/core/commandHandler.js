const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config');
const { logger } = require('../utils/logger');

/** 遞迴收集目錄下所有檔案 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * 載入所有斜線指令。
 * 每個指令檔 export：
 *  - data: SlashCommandBuilder（或 builder 陣列）
 *  - run(interaction, client): async
 *  - category: 分類字串（預設 'utility'）
 *  - cooldown: 冷卻毫秒（可選）
 *  - ownerOnly: 僅擁有者可用的布林（可選）
 */
async function loadCommands(client) {
  const dir = path.join(__dirname, '..', 'commands');
  if (!fs.existsSync(dir)) {
    logger.warn('commands', '找不到指令目錄');
    return;
  }
  const files = walk(dir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(file);
      const defs = Array.isArray(mod) ? mod : [mod];
      for (const def of defs) {
        if (!def || !def.data) continue;
        const name = def.data.name;
        if (client.commands.has(name)) {
          logger.warn('commands', `指令名稱重複：${name}（${file}）`);
          continue;
        }
        client.commands.set(name, {
          ...def,
          category: def.category || 'utility',
          file,
        });
      }
    } catch (e) {
      logger.error('commands', `載入 ${file} 失敗：${e.message}\n${e.stack || ''}`);
    }
  }
  logger.info('commands', `已載入 ${client.commands.size} 個斜線指令`);
}

/** 註冊斜線指令到 Discord */
async function registerCommands(client) {
  if (!config.token) return;
  const commands = [...client.commands.values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
      logger.info('commands', `已註冊 ${commands.length} 個指令到開發伺服器 ${config.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      logger.info('commands', `已註冊 ${commands.length} 個全域指令（可能需數小時生效）`);
    }
  } catch (e) {
    logger.error('commands', `註冊指令失敗：${e.message}`);
  }
}

module.exports = { loadCommands, registerCommands, walk };
