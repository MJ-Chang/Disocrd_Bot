const { success, info, withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/** 預設歡迎訊息 */
const DEFAULT_WELCOME = () => t('歡迎 {mention} 加入 **{guild}**！目前共有 {count} 位成員。', 'Welcome {mention} to **{guild}**! We now have {count} members.');
/** 預設歡送訊息 */
const DEFAULT_GOODBYE = () => t('{user} 離開了伺服器。', '{user} left the server.');
/** 預設私訊內容 */
const DEFAULT_DM = () => t('歡迎加入 **{guild}**！希望你玩得開心！', 'Welcome to **{guild}**! Hope you enjoy your stay!');

/**
 * 將樣板中的變數替換為成員資料
 * 支援：{user}=使用者名稱、{mention}=<@id>、{tag}=使用者標籤、{guild}=伺服器名、{count}=成員數
 * @param {string|null|undefined} template
 * @param {{user: {username: string, discriminator?: string, id?: string}, guild?: {name?: string, memberCount?: number}}} member
 * @returns {string}
 */
function renderTemplate(template, member) {
  const user = member?.user || member || {};
  const username = user.username || '未知/unknown';
  const tag =
    user.discriminator && user.discriminator !== '0'
      ? `${username}#${user.discriminator}`
      : username;
  const mention = user.id ? `<@${user.id}>` : '@?';
  const guildName = member?.guild?.name || t('此伺服器', 'this server');
  const count = member?.guild?.memberCount ?? 0;
  return String(template == null ? '' : template)
    .replaceAll('{user}', username)
    .replaceAll('{mention}', mention)
    .replaceAll('{tag}', tag)
    .replaceAll('{guild}', guildName)
    .replaceAll('{count}', String(count));
}

/**
 * 成員加入：歡迎訊息（頻道 + 私訊）與自動身分組
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').GuildMember} member
 */
async function onGuildMemberAdd(client, member) {
  try {
    const settings = await client.settings.get(member.guild.id);

    // ==== 歡迎訊息（頻道） ====
    if (settings.welcome?.enabled && settings.welcome.channel) {
      const channel = member.guild.channels.cache.get(settings.welcome.channel);
      if (channel && channel.isTextBased()) {
        const text = settings.welcome.message || DEFAULT_WELCOME();
        const embed = success(t('🎉 歡迎加入！', '🎉 Welcome!'), renderTemplate(text, member))
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        withFooter(embed, client);
        await channel.send({ embeds: [embed] });
      }
    }

    // ==== 私訊歡迎 ====
    if (settings.welcome?.dm) {
      try {
        const text = settings.welcome.dmMessage || settings.welcome.message || DEFAULT_DM();
        await member.send(renderTemplate(text, member));
      } catch (e) {
        // 私訊失敗（關閉私訊、被封鎖等）靜默忽略
        logger.debug('welcome', `私訊 ${member.user?.tag || member.id} 失敗：${e.message}`);
      }
    }

    // ==== 自動身分組 ====
    if (Array.isArray(settings.autoroles)) {
      let me = member.guild.members.me;
      if (!me) {
        try {
          me = await member.guild.members.fetch(client.user.id);
        } catch (e) {
          me = null;
        }
      }
      for (const roleId of settings.autoroles) {
        try {
          const role = member.guild.roles.cache.get(roleId);
          if (!role) continue; // 身分組已被刪除
          if (role.managed) continue; // 整合管理的身分組無法手動授予
          if (me && me.roles.highest.comparePositionTo(role) <= 0) continue; // 機器人階層不足
          if (!member.roles.cache.has(role.id)) await member.roles.add(role);
        } catch (e) {
          // 單一身分組失敗靜默，不影響其他身分組
          logger.debug('welcome', `自動身分組 ${roleId} 授予失敗：${e.message}`);
        }
      }
    }
  } catch (e) {
    logger.error('welcome', `歡迎處理失敗（${member.guild.id}）：${e.stack || e.message}`);
  }
}

/**
 * 成員離開：歡送訊息
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').GuildMember} member
 */
async function onGuildMemberRemove(client, member) {
  try {
    const settings = await client.settings.get(member.guild.id);
    if (settings.goodbye?.enabled && settings.goodbye.channel) {
      const channel = member.guild.channels.cache.get(settings.goodbye.channel);
      if (channel && channel.isTextBased()) {
        const text = settings.goodbye.message || DEFAULT_GOODBYE();
        const embed = info(t('👋 再見！', '👋 Goodbye!'), renderTemplate(text, member));
        withFooter(embed, client);
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    logger.error('welcome', `歡送處理失敗（${member.guild.id}）：${e.stack || e.message}`);
  }
}

/**
 * 傳送測試歡迎訊息到指定頻道（供網頁控制面板使用）
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildTextBasedChannel} channel
 */
async function sendTest(client, guild, channel) {
  const settings = await client.settings.get(guild.id);
  const text = settings.welcome?.message || DEFAULT_WELCOME();
  const embed = success(t('🎉 歡迎加入！', '🎉 Welcome!'), renderTemplate(text, { user: client.user, guild }))
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }));
  withFooter(embed, client, t('測試歡迎訊息', 'Test welcome message'));
  await channel.send({ embeds: [embed] });
  return true;
}

module.exports = { renderTemplate, onGuildMemberAdd, onGuildMemberRemove, sendTest, DEFAULT_WELCOME, DEFAULT_GOODBYE };
