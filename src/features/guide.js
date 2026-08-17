const { EmbedBuilder } = require('discord.js');
const { CategoryLabels, Colors } = require('../utils/constants');
const { withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/**
 * 指令說明頻道：在指定頻道固定顯示一份「所有可用指令」的說明，
 * 成員加入即可查看，不需要打 /help。
 * 設定：guide.enabled / guide.channel / guide.messageId
 */

/** 建立指令說明 embeds（預設隱藏管理/管理員專用指令） */
function buildEmbeds(client, canAdmin = false, canMod = false) {
  const commands = [...client.commands.values()].filter((c) => {
    if (c.adminOnly && !canAdmin) return false;
    if (c.modOnly && !canMod) return false;
    return true;
  });

  const grouped = {};
  for (const c of commands) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  const embeds = [];
  for (const [category, cmds] of Object.entries(grouped).sort()) {
    const embed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle(`${CategoryLabels[category] || category} ${t('指令', 'Commands')}`)
      .setDescription(cmds.map((c) => `\`/${c.data.name}\` — ${c.data.description || ''}`).join('\n'))
      .setFooter({ text: t('點擊下方指令即可使用 ｜ Type / to browse', 'Type / to see all commands') });
    embeds.push(embed);
  }
  return embeds;
}

/**
 * 發送/更新指令說明到設定的頻道（供網頁控制面板使用）
 * @returns {Promise<{ok: boolean, error?: string, message?: string}>}
 */
async function deploy(client, guild) {
  const g = (await client.settings.get(guild.id)).guide || {};
  if (!g.enabled || !g.channel) {
    return { ok: false, error: t('請先在設定中心勾選「指令說明頻道」並選擇頻道，再儲存。', "Enable 'Command Guide' and pick a channel in the settings center, then save.") };
  }
  const channel = guild.channels.cache.get(g.channel);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, error: t('找不到指令說明頻道（可能已被刪除），請重新選擇。', 'Guide channel not found (deleted?). Please pick it again.') };
  }

  const embeds = buildEmbeds(client, false, false);
  if (g.messageId) {
    const existing = await channel.messages.fetch(g.messageId).catch(() => null);
    if (existing) {
      await existing.edit({ embeds });
      return { ok: true, message: t(`已更新 <#${channel.id}> 的指令說明。`, `Updated the command guide in <#${channel.id}>.`) };
    }
  }
  const msg = await channel.send({ embeds });
  await client.settings.set(guild.id, 'guide.messageId', msg.id);
  return { ok: true, message: t(`✅ 已發送指令說明到 <#${channel.id}>。`, `✅ Command guide sent to <#${channel.id}>.`) };
}

/** 開機時同步所有已啟用指令說明的伺服器（指令更新後自動保持最新） */
async function onReady(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const s = await client.settings.get(guild.id);
      if (s.guide?.enabled && s.guide.channel) {
        await deploy(client, guild);
      }
    } catch (e) {
      logger.warn('guide', `同步 ${guild.id} 的指令說明失敗：${e.message}`);
    }
  }
}

module.exports = { buildEmbeds, deploy, onReady };
