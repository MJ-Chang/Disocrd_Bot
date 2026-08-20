const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Colors } = require('../utils/constants');
const { sendError, sendSuccess, withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

const PANEL_TITLE = () => t('🔐 身分驗證', '🔐 Verification');
const PANEL_DESCRIPTION = () => t('點擊下方按鈕完成驗證', 'Click the button below to verify');
const DEFAULT_LABEL = () => t('✅ 點我驗證', '✅ Verify me');

/** 每伺服器上次提醒時間（避免短時間重複提醒） */
const lastRemind = new Map();

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

      // 移除「未驗證」身分組（若有設定）
      const unverifiedId = settings.verify?.unverifiedRole;
      if (unverifiedId && member.roles.cache.has(unverifiedId)) {
        await member.roles.remove(unverifiedId).catch(() => {});
      }

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

/**
 * 成員加入：發放「未驗證」身分組（由 guildMemberAdd 事件呼叫）
 */
async function onGuildMemberAdd(client, member) {
  try {
    if (member.user.bot) return;
    const s = await client.settings.get(member.guild.id);
    const roleId = s.verify?.unverifiedRole;
    if (!s.verify?.enabled || !roleId) return;
    const role = member.guild.roles.cache.get(roleId);
    if (!role) return;
    const me = member.guild.members.me;
    if (me && me.roles.highest.comparePositionTo(role) <= 0) return; // 階層不足
    if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
  } catch (e) {
    logger.warn('verify', `授予未驗證身分組失敗（${member.id}）：${e.message}`);
  }
}

/**
 * 傳送測試提醒訊息（供控制面板預覽提醒內容；使用假提及，不會真的 Tag 成員）。
 * @returns {Promise<{ok: boolean, error?: string, message?: string}>}
 */
async function sendTestReminder(client, guild) {
  const v = (await client.settings.get(guild.id)).verify || {};
  if (!v.remindChannel) {
    return { ok: false, error: t('請先設定「提醒頻道」並儲存。', 'Set the reminder channel and save first.') };
  }
  const channel = guild.channels.cache.get(v.remindChannel);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, error: t('找不到提醒頻道（可能已被刪除），請重新選擇。', 'Reminder channel not found (deleted?). Please pick it again.') };
  }

  const count = v.unverifiedRole
    ? guild.members.cache.filter((m) => !m.user.bot && m.roles.cache.has(v.unverifiedRole)).size
    : 0;
  const verifyChannel = v.channel ? `<#${v.channel}>` : '';
  const fakeUsers = '@user1 @user2'; // 測試用假提及，不真的 Tag 任何人

  let text;
  const custom = v.remindMessage;
  if (custom && custom.trim()) {
    text = custom
      .replaceAll('{users}', fakeUsers)
      .replaceAll('{channel}', verifyChannel)
      .replaceAll('{guild}', guild.name)
      .replaceAll('{count}', String(count));
  } else {
    // 完整句直接雙語，避免嵌套 t() 造成文字重複
    text = verifyChannel
      ? t(
          `${fakeUsers} 你還沒有完成驗證！請到 ${verifyChannel} 點擊上方按鈕完成驗證，解鎖所有頻道。`,
          `${fakeUsers} You haven't verified yet! Please go to ${verifyChannel} and click the button above to verify and unlock all channels.`
        )
      : t(
          `${fakeUsers} 你還沒有完成驗證！請到驗證頻道點擊按鈕完成驗證，解鎖所有頻道。`,
          `${fakeUsers} You haven't verified yet! Please go to the verify channel and click the button to verify and unlock all channels.`
        );
  }

  await channel.send({
    content: t(
      `📋 測試提醒（TEST）｜目前 ${count} 位未驗證成員：\n\n`,
      `📋 Test reminder｜${count} unverified member(s) now:\n\n`
    ) + text,
  });
  return { ok: true, message: t(`✅ 已發送測試提醒到 <#${channel.id}>。`, `✅ Test reminder sent to <#${channel.id}>.`) };
}

/**
 * 定期提醒未驗證成員（「不驗證就退出」壓力機制）。
 * 每 5 分鐘檢查一次，每伺服器依 remindInterval（分鐘）間隔發送一次。
 */
async function checkReminders(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const s = await client.settings.get(guild.id);
      const v = s.verify || {};
      if (!v.enabled || !v.remindEnabled || !v.remindChannel || !v.unverifiedRole) continue;

      const intervalMs = (v.remindInterval || 60) * 60 * 1000;
      const last = lastRemind.get(guild.id);
      if (last && Date.now() - last < intervalMs) continue;

      const channel = guild.channels.cache.get(v.remindChannel);
      if (!channel || !channel.isTextBased()) continue;

      const members = guild.members.cache.filter((m) => !m.user.bot && m.roles.cache.has(v.unverifiedRole));
      lastRemind.set(guild.id, Date.now());
      if (members.size === 0) continue;

      const mentioned = [...members.values()].slice(0, 20);
      const extra = members.size > 20 ? t(`…及另外 ${members.size - 20} 位成員`, `…and ${members.size - 20} more members`) : '';
      const verifyChannel = v.channel ? `<#${v.channel}>` : '';

      let text;
      const custom = v.remindMessage;
      if (custom && custom.trim()) {
        text = custom
          .replaceAll('{users}', mentioned.map((m) => m.toString()).join(' '))
          .replaceAll('{channel}', verifyChannel)
          .replaceAll('{guild}', guild.name)
          .replaceAll('{count}', String(members.size));
      } else {
        const users = mentioned.map((m) => m.toString()).join(' ');
        // 完整句直接雙語，避免嵌套 t() 造成文字重複
        text = verifyChannel
          ? t(
              `${users} 你還沒有完成驗證！請到 ${verifyChannel} 點擊上方按鈕完成驗證，解鎖所有頻道。${extra}`,
              `${users} You haven't verified yet! Please go to ${verifyChannel} and click the button above to verify and unlock all channels.${extra}`
            )
          : t(
              `${users} 你還沒有完成驗證！請到驗證頻道點擊按鈕完成驗證，解鎖所有頻道。${extra}`,
              `${users} You haven't verified yet! Please go to the verify channel and click the button to verify and unlock all channels.${extra}`
            );
      }
      await channel.send({ content: text });
    } catch (e) {
      logger.warn('verify', `提醒檢查失敗（${guild.id}）：${e.message}`);
    }
  }
}

/** 開機初始化：啟動定期提醒檢查（每 5 分鐘） */
async function onReady(client) {
  // 初始化計時，避免啟動後立刻提醒
  for (const guild of client.guilds.cache.values()) {
    lastRemind.set(guild.id, Date.now());
  }
  setInterval(() => {
    checkReminders(client).catch((e) => logger.error('verify', `提醒迴圈錯誤：${e.message}`));
  }, 5 * 60 * 1000);
}

module.exports = { setup, deploy, updateMessage, handleButton, onGuildMemberAdd, checkReminders, sendTestReminder, onReady };
