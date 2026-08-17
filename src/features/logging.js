/** 審計日誌：依設定發送日誌嵌入 */
const { PermissionFlagsBits } = require('discord.js');
const { info, withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');

/**
 * 發送日誌（需 logs.enabled、logs.channel、logs.events[eventKey] 皆為真）
 * @returns {Promise<boolean>} 是否成功發送
 */
async function sendLog(client, guild, embed, eventKey) {
  try {
    if (!guild) return false;
    const s = await client.settings.get(guild.id);
    const logs = (s && s.logs) || {};
    if (!logs.enabled || !logs.channel || !logs.events || !logs.events[eventKey]) return false;

    let channel = guild.channels.cache.get(logs.channel);
    if (!channel) channel = await guild.channels.fetch(logs.channel).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;
    if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return false;

    withFooter(embed, client, t('審計日誌', 'Audit Log'));
    await channel.send({ embeds: [embed] });
    return true;
  } catch (e) {
    return false;
  }
}

/** 語音日誌：成員加入 / 離開 / 轉移語音頻道 */
async function handleVoiceState(client, oldState, newState) {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const s = await client.settings.get(guild.id);
    const logs = (s && s.logs) || {};
    if (!logs.enabled || !logs.events || !logs.events.voice) return;

    let action = null;
    let channelName = null;
    if (oldState.channelId && !newState.channelId) {
      action = t('離開', 'Left');
      channelName = oldState.channel?.name || oldState.channelId;
    } else if (!oldState.channelId && newState.channelId) {
      action = t('加入', 'Joined');
      channelName = newState.channel?.name || newState.channelId;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      action = t('轉移', 'Moved');
      channelName = newState.channel?.name || newState.channelId;
    }
    if (!action) return;

    const embed = info(t('🔊 語音事件', '🔊 Voice Event')).addFields(
      { name: t('成員', 'Member'), value: t(`${member.displayName || member.user.tag}（\`${member.id}\`）`, `${member.displayName || member.user.tag} (\`${member.id}\`)`) },
      { name: t('動作', 'Action'), value: action, inline: true },
      { name: t('頻道', 'Channel'), value: channelName, inline: true }
    );
    await sendLog(client, guild, embed, 'voice');
  } catch (e) {
    /* 靜默 */
  }
}

module.exports = { sendLog, handleVoiceState };
