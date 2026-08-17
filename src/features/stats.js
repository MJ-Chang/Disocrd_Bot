const { ChannelType } = require('discord.js');
const { logger } = require('../utils/logger');
const { t } = require('../utils/i18n');

/**
 * 伺服器統計頻道：在分類中建立顯示成員數的語音頻道，定期更新。
 * 設定路徑：stats.enabled / stats.category / stats.channels.{members,humans,bots,online,boosters}
 */
const STAT_DEFS = [
  { key: 'members', label: t('👥 成員', '👥 Members'), count: (g) => g.memberCount },
  { key: 'humans', label: t('🧑 人類', '🧑 Humans'), count: (g) => g.members.cache.filter((m) => !m.user.bot).size },
  { key: 'bots', label: t('🤖 機器人', '🤖 Bots'), count: (g) => g.members.cache.filter((m) => m.user.bot).size },
  { key: 'online', label: t('🟢 線上', '🟢 Online'), count: (g) => g.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size },
  { key: 'boosters', label: t('🚀 加成', '🚀 Boosters'), count: (g) => g.premiumSubscriptionCount },
];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 建立統計頻道並更新設定 */
async function setup(client, guild, category) {
  const channels = {};
  for (const def of STAT_DEFS) {
    const ch = await guild.channels.create({
      name: `${def.label}: ${pad(def.count(guild))}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: ['Connect'] },
      ],
    });
    channels[def.key] = ch.id;
  }
  await client.settings.set(guild.id, 'stats', {
    enabled: true,
    category: category.id,
    channels,
  });
  return channels;
}

/** 刷新統計頻道名稱 */
async function refresh(client, guild) {
  const stats = (await client.settings.get(guild.id)).stats;
  if (!stats || !stats.enabled) return;
  for (const def of STAT_DEFS) {
    const channelId = stats.channels?.[def.key];
    if (!channelId) continue;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) continue;
    const newName = `${def.label}: ${pad(def.count(guild))}`;
    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => {});
    }
  }
}

/** 停用並刪除統計頻道 */
async function disable(client, guild) {
  const stats = (await client.settings.get(guild.id)).stats;
  if (stats?.channels) {
    for (const id of Object.values(stats.channels)) {
      const ch = guild.channels.cache.get(id);
      if (ch) await ch.delete().catch(() => {});
    }
  }
  await client.settings.set(guild.id, 'stats', {
    enabled: false,
    category: null,
    channels: { members: null, humans: null, bots: null, online: null, boosters: null },
  });
}

async function onReady(client) {
  // 定期刷新所有啟用統計的伺服器
  const refreshAll = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const stats = (await client.settings.get(guild.id)).stats;
        if (stats?.enabled) await refresh(client, guild);
      } catch (e) {
        logger.error('stats', `刷新 ${guild.id} 失敗：${e.message}`);
      }
    }
  };
  await refreshAll();
  setInterval(refreshAll, 10 * 60 * 1000);
}

module.exports = { setup, refresh, disable, onReady };
