const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { Colors } = require('../utils/constants');
const { withFooter } = require('../utils/embeds');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/**
 * GitHub 更新通知：定期檢查指定庫的最新 Release / Commit，
 * 有更新就發送通知到設定的頻道。
 * 設定：githubWatch.enabled / channel / watchType / branch / repos
 * 基準線紀錄存於 collection 'githubWatch'（key: guildId:watchType:repo）
 */

/** 抓取庫的最新資訊（releases 或 commits）；失敗/無資料回傳 null */
async function fetchRepo(repo, watchType, branch) {
  const url =
    watchType === 'commits'
      ? `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(branch || 'main')}&per_page=1`
      : `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = { 'User-Agent': 'disocrd-bot', Accept: 'application/vnd.github+json' };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return null; // 庫不存在或沒有 release
  if (res.status === 403 || res.status === 429) {
    logger.warn('github', `${repo}：GitHub API 速率限制（未設定 GITHUB_TOKEN 時每小時 60 次）`);
    return null;
  }
  if (!res.ok) {
    logger.warn('github', `${repo}：API 錯誤 HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (watchType === 'commits') {
    const c = Array.isArray(data) ? data[0] : null;
    if (!c) return null;
    return {
      id: c.sha,
      title: (c.commit?.message || '').split('\n')[0].slice(0, 80) || c.sha.slice(0, 7),
      url: c.html_url || `https://github.com/${repo}/commit/${c.sha}`,
      at: c.commit?.author?.date || null,
    };
  }
  // releases
  if (!data.tag_name) return null;
  return {
    id: data.tag_name,
    title: data.name || data.tag_name,
    url: data.html_url || `https://github.com/${repo}/releases`,
    body: data.body || '',
    at: data.published_at || null,
  };
}

/** 建立通知 Embed */
function buildEmbed(repo, info, watchType) {
  const embed = new EmbedBuilder()
    .setColor(Colors.GITHUB || 0x2dba4e)
    .setTitle(watchType === 'commits' ? t('🔀 新提交', '🔀 New Commit') : t('🎉 新版本', '🎉 New Release'))
    .setURL(info.url)
    .setDescription(
      watchType === 'commits'
        ? `**${info.title}**\n[${repo}](${info.url})`
        : `**${info.title}**\n[${repo}](${info.url})\n\n${(info.body || '').slice(0, 800) || t('（無說明）', '(no description)')}`
    )
    .setAuthor({ name: `GitHub: ${repo}`, url: `https://github.com/${repo}` });
  if (info.at) embed.setTimestamp(new Date(info.at));
  return embed;
}

/** 檢查單一庫，有新更新則通知並更新基準線 */
async function checkRepo(client, guild, channel, repo, g) {
  const col = client.db.collection('githubWatch');
  const key = `${guild.id}:${g.watchType || 'releases'}:${repo}`;
  const record = col.get(key) || {};

  const info = await fetchRepo(repo, g.watchType || 'releases', g.branch);
  if (!info) return { ok: false, reason: 'no-data' };

  const isNew = !record.lastSeen || record.lastSeen !== info.id;
  const shouldNotify = isNew && !!record.lastSeen; // 第一次只記錄基準線，不發通知

  col.set(key, { lastSeen: info.id, name: repo, at: Date.now() });

  if (shouldNotify) {
    await channel.send({ embeds: [buildEmbed(repo, info, g.watchType || 'releases')] });
    logger.info('github', `${guild.name} 通知 ${repo} 更新：${info.id}`);
    return { ok: true, notified: true, title: info.title };
  }
  return { ok: true, notified: false, first: !record.lastSeen };
}

/** 正規化庫設定（相容舊格式：純字串 → {name}；缺欄位補預設） */
function normalizeRepo(r, defaultChannel) {
  const entry = typeof r === 'string' ? { name: r } : r || {};
  return {
    name: String(entry.name || '').trim(),
    channel: entry.channel || defaultChannel || null,
    watchType: entry.watchType || 'releases',
    branch: entry.branch || 'main',
  };
}

/** 檢查單一伺服器的所有庫（供控制面板「立即檢查」使用） */
async function checkGuild(client, guild) {
  const s = await client.settings.get(guild.id);
  const g = s.githubWatch || {};
  const defaultChannel = g.defaultChannel || g.channel || null; // g.channel 相容舊格式
  if (!g.enabled || !Array.isArray(g.repos) || g.repos.length === 0) {
    return { ok: false, error: t('請先在設定中心啟用 GitHub 通知並加入至少一個庫。', 'Enable GitHub notifications and add at least one repo in the settings center.') };
  }

  const repos = g.repos.map((r) => normalizeRepo(r, defaultChannel)).filter((r) => r.name);
  if (repos.length === 0) {
    return { ok: false, error: t('庫清單格式錯誤，請確認每個庫都是 owner/repo 格式。', 'Invalid repo list. Make sure each repo is in owner/repo format.') };
  }

  let notified = 0;
  let first = 0;
  let skipped = 0;
  for (const repo of repos) {
    const channel = repo.channel ? guild.channels.cache.get(repo.channel) : null;
    if (!channel || !channel.isTextBased()) {
      logger.warn('github', `${repo.name}：找不到通知頻道，略過`);
      skipped += 1;
      continue;
    }
    try {
      const r = await checkRepo(client, guild, channel, repo.name, repo);
      if (r.notified) notified += 1;
      if (r.first) first += 1;
    } catch (e) {
      logger.warn('github', `檢查 ${repo.name} 失敗：${e.message}`);
    }
  }
  return { ok: true, notified, first, total: repos.length, skipped };
}

/** 檢查所有伺服器（排程用） */
async function checkAll(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await checkGuild(client, guild);
    } catch (e) {
      logger.warn('github', `檢查 ${guild.id} 失敗：${e.message}`);
    }
  }
}

/** 開機初始化：啟動定期檢查並先跑一次建立基準線 */
async function onReady(client) {
  const intervalMs = config.githubCheckIntervalMin * 60 * 1000;
  logger.info('github', `GitHub 檢查間隔：${config.githubCheckIntervalMin} 分鐘（可用 .env 的 GITHUB_CHECK_INTERVAL 調整）`);
  // 先跑一次：建立各庫的基準線（不會發通知）
  setTimeout(() => checkAll(client).catch(() => {}), 30 * 1000);
  setInterval(() => checkAll(client).catch(() => {}), intervalMs);
}

module.exports = { fetchRepo, buildEmbed, checkRepo, checkGuild, checkAll, onReady };
