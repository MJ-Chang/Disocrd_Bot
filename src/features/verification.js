const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Colors } = require('../utils/constants');
const { sendError, sendSuccess, withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

const PANEL_TITLE = () => t('🔐 身分驗證', '🔐 Verification');
const PANEL_DESCRIPTION = () => t('點擊下方按鈕完成驗證', 'Click the button below to verify');
const DEFAULT_LABEL = () => t('✅ 點我驗證', '✅ Verify me');

/** 建立面板 Embed（description 可為自訂規則/說明文字） */
function buildEmbed(client, message) {
  const embed = new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle(PANEL_TITLE())
    .setDescription(message && message.trim() ? message : PANEL_DESCRIPTION());
  withFooter(embed, client);
  return embed;
}

/** 建立驗證按鈕列 */
function buildRow(label) {
  const button = new ButtonBuilder()
    .setCustomId('verify:click')
    .setStyle(ButtonStyle.Success)
    .setLabel(label || DEFAULT_LABEL());
  return new ActionRowBuilder().addComponents(button);
}

/**
 * 建立驗證面板（Embed + 按鈕）並儲存設定
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @param {import('discord.js').Role} role
 * @param {string} [label] 按鈕文字
 * @param {string} [message] 面板說明文字（可放伺服器規則）
 * @returns {Promise<import('discord.js').Message>} 面板訊息
 */
async function setup(client, guild, channel, role, label, message) {
  const msg = await channel.send({
    embeds: [buildEmbed(client, message)],
    components: [buildRow(label)],
  });

  await client.settings.set(guild.id, 'verify.enabled', true);
  await client.settings.set(guild.id, 'verify.role', role.id);
  await client.settings.set(guild.id, 'verify.channel', channel.id);
  await client.settings.set(guild.id, 'verify.panelMessage', msg.id);
  await client.settings.set(guild.id, 'verify.buttonLabel', label || DEFAULT_LABEL());
  await client.settings.set(guild.id, 'verify.message', message && message.trim() ? message.trim() : null);
  return msg;
}

/**
 * 依設定中心儲存的設定發送/更新驗證面板（供網頁控制面板使用）
 * @returns {Promise<{ok: boolean, error?: string, message?: string}>}
 */
async function deploy(client, guild) {
  const v = (await client.settings.get(guild.id)).verify || {};
  if (!v.enabled || !v.channel || !v.role) {
    return { ok: false, error: t('請先在設定中心勾選「按鈕驗證」、選擇驗證頻道與身分組，並儲存。', "Enable 'Button Verification', pick a channel and role in the settings center, then save.") };
  }
  const channel = guild.channels.cache.get(v.channel);
  if (!channel || !channel.isTextBased()) return { ok: false, error: t('找不到驗證頻道（可能已被刪除），請重新選擇。', 'Verification channel not found (deleted?). Please pick it again.') };
  const role = guild.roles.cache.get(v.role);
  if (!role) return { ok: false, error: t('找不到驗證身分組（可能已被刪除），請重新選擇。', 'Verification role not found (deleted?). Please pick it again.') };

  // 若已有面板訊息 → 直接更新；否則發送新面板
  if (v.panelMessage) {
    const existing = await channel.messages.fetch(v.panelMessage).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [buildEmbed(client, v.message)], components: [buildRow(v.buttonLabel)] });
      return { ok: true, message: t(`已更新 <#${channel.id}> 的既有驗證面板。`, `Updated the existing verification panel in <#${channel.id}>.`) };
    }
  }
  const msg = await setup(client, guild, channel, role, v.buttonLabel, v.message);
  return { ok: true, message: t(`✅ 已發送驗證面板到 <#${channel.id}>。`, `✅ Verification panel sent to <#${channel.id}>.`) };
}

/**
 * 更新驗證面板的說明文字（編輯既有面板訊息）
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function updateMessage(client, guild, text) {
  const v = (await client.settings.get(guild.id)).verify || {};
  if (!v.enabled || !v.channel || !v.panelMessage) {
    return { ok: false, error: t('驗證系統尚未設定，請先使用 /verify setup 或設定中心發送面板。', 'Verification is not set up. Use /verify setup or send the panel from the settings center.') };
  }
  const channel = guild.channels.cache.get(v.channel);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, error: t('找不到驗證面板所在的頻道。', 'Verification panel channel not found.') };
  }
  const msg = await channel.messages.fetch(v.panelMessage).catch(() => null);
  if (!msg) {
    return { ok: false, error: t('找不到驗證面板訊息（可能已被刪除），請重新發送面板。', 'Verification panel message not found (deleted?). Send the panel again.') };
  }
  await msg.edit({ embeds: [buildEmbed(client, text)] });
  await client.settings.set(guild.id, 'verify.message', text && text.trim() ? text.trim() : null);
  return { ok: true };
}

/**
 * 處理驗證按鈕（customId: verify:click）
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<boolean>} 是否已處理
 */
async function handleButton(client, interaction) {
  if (interaction.customId !== 'verify:click') return false;

  try {
    const settings = await client.settings.get(interaction.guildId);
    const roleId = settings.verify?.role;
    const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;

    // 驗證功能未設定或已停用
    if (!settings.verify?.enabled || !role) {
      await sendError(interaction, t('驗證功能尚未設定或已停用', 'Verification is not set up or has been disabled'));
      return true;
    }

    const member = interaction.member;

    // 已驗證過
    if (member.roles.cache.has(role.id)) {
      await sendSuccess(interaction, t('你已經驗證過了', 'You are already verified'));
      return true;
    }

    // 授予驗證身分組
    try {
      await member.roles.add(role);
      await sendSuccess(interaction, t('驗證成功，歡迎加入！', 'Verification successful, welcome!'));
    } catch (e) {
      logger.error('verify', `授予驗證身分組失敗（${member.id}）：${e.message}`);
      await sendError(interaction, t('無法授予驗證身分組，請確認機器人權限與身分組階層。', "Couldn't assign the verification role. Check bot permissions and role hierarchy."));
    }
    return true;
  } catch (e) {
    logger.error('verify', `驗證按鈕處理失敗：${e.stack || e.message}`);
    try {
      await sendError(interaction, t('驗證處理時發生錯誤，請稍後再試。', 'An error occurred while verifying. Please try again later.'));
    } catch (e2) {
      /* 忽略二次錯誤 */
    }
    return true;
  }
}

module.exports = { setup, deploy, updateMessage, handleButton };
