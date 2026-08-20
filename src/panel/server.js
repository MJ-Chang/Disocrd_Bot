/**
 * 網頁控制面板伺服器（Express）
 * - 所有 /api 路由都需要 Token（Authorization: Bearer <token> 或 ?token=）
 * - 靜態頁面位於 ./public
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { logger, subscribe, getHistory } = require('../utils/logger');

const TYPE_LABELS = {
  0: '文字',
  2: '語音',
  4: '分類',
  5: '公告',
  13: '舞台',
  15: '論壇',
};

function createPanel(client) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const token = client.config.panel.token || crypto.randomBytes(16).toString('hex');
  if (!client.config.panel.token) {
    logger.warn('panel', `未設定 PANEL_TOKEN，已自動產生（本次啟動有效，重啟後會變更）：${token}`);
  }
  logger.info('panel', `控制面板 Token：${token}`);

  // ===== 驗證中介層 =====
  const auth = (req, res, next) => {
    const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
    if (!t || t !== token) return res.status(401).json({ error: 'unauthorized' });
    next();
  };
  app.use('/api', auth);

  // ===== 狀態 =====
  app.get('/api/status', (req, res) => {
    const pkg = require('../../package.json');
    res.json({
      online: !!client.ready,
      user: client.user
        ? { tag: client.user.tag, id: client.user.id, avatar: client.user.displayAvatarURL({ size: 128 }) }
        : null,
      startedAt: client.startedAt,
      uptimeMs: Date.now() - (client.startedAt || Date.now()),
      ping: client.ws ? Math.round(client.ws.ping) : null,
      guilds: client.guilds ? client.guilds.cache.size : 0,
      users: client.users ? client.users.cache.size : 0,
      commands: client.commands ? client.commands.size : 0,
      version: pkg.version,
      node: process.version,
      discordjs: require('discord.js').version,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  });

  // ===== 伺服器清單 =====
  app.get('/api/guilds', (req, res) => {
    const list = client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 128 }),
      memberCount: g.memberCount,
      ownerId: g.ownerId,
      created: g.createdTimestamp,
    }));
    res.json(list.sort((a, b) => b.memberCount - a.memberCount));
  });

  // ===== 頻道清單（供設定表單下拉選單） =====
  app.get('/api/guild/:id/channels', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    const list = guild.channels.cache.map((c) => ({
      id: c.id,
      name: c.name,
      type: TYPE_LABELS[c.type] || String(c.type),
      parentId: c.parentId,
      isText: !!c.isTextBased(),
      isVoice: !!c.isVoiceBased(),
      isCategory: c.type === 4,
    }));
    res.json(list);
  });

  // ===== 身分組清單 =====
  app.get('/api/guild/:id/roles', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    const list = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: `#${r.color.toString(16).padStart(6, '0')}`,
        position: r.position,
        managed: r.managed,
        hoist: r.hoist,
      }));
    res.json(list);
  });

  // ===== 伺服器基本資訊 =====
  app.get('/api/guild/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
    });
  });

  // ===== 設定中心動作：發送/更新面板 =====
  app.post('/api/guild/:id/verify/send', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    try {
      const r = await require('../features/verification').deploy(client, guild);
      if (!r.ok) return res.status(400).json({ error: r.error });
      res.json({ ok: true, message: r.message });
    } catch (e) {
      res.status(500).json({ error: `發送失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/verify/remind-test', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    try {
      const r = await require('../features/verification').sendTestReminder(client, guild);
      if (!r.ok) return res.status(400).json({ error: r.error });
      res.json({ ok: true, message: r.message });
    } catch (e) {
      res.status(500).json({ error: `發送失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/tickets/send', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    try {
      const r = await require('../features/tickets').deploy(client, guild);
      if (!r.ok) return res.status(400).json({ error: r.error });
      res.json({ ok: true, message: r.message });
    } catch (e) {
      res.status(500).json({ error: `發送失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/welcome/test', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    const channel = guild.channels.cache.get(req.body?.channel);
    if (!channel || !channel.isTextBased()) return res.status(400).json({ error: '請選擇一個文字頻道。' });
    try {
      await require('../features/welcome').sendTest(client, guild, channel);
      res.json({ ok: true, message: `已傳送測試歡迎訊息到 <#${channel.id}>。` });
    } catch (e) {
      res.status(500).json({ error: `傳送失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/stats/setup', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    const category = guild.channels.cache.get(req.body?.category);
    if (!category || !category.isCategory()) return res.status(400).json({ error: '請選擇一個分類。' });
    try {
      await require('../features/stats').setup(client, guild, category);
      res.json({ ok: true, message: '✅ 統計頻道已建立。' });
    } catch (e) {
      res.status(500).json({ error: `建立失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/guide/send', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    try {
      const r = await require('../features/guide').deploy(client, guild);
      if (!r.ok) return res.status(400).json({ error: r.error });
      res.json({ ok: true, message: r.message });
    } catch (e) {
      res.status(500).json({ error: `發送失敗：${e.message}` });
    }
  });

  app.post('/api/guild/:id/github/check', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    try {
      const r = await require('../features/githubWatch').checkGuild(client, guild);
      if (!r.ok) return res.status(400).json({ error: r.error });
      const { t } = require('../utils/i18n');
      res.json({
        ok: true,
        message: t(
          `✅ 已檢查 ${r.total} 個庫${r.notified ? `，發現 ${r.notified} 個更新並已通知` : ''}${r.first ? `（${r.first} 個首次建立基準線）` : ''}`,
          `Checked ${r.total} repos${r.notified ? `, ${r.notified} update(s) notified` : ''}${r.first ? ` (${r.first} baseline(s) set)` : ''}`
        ),
      });
    } catch (e) {
      res.status(500).json({ error: `檢查失敗：${e.message}` });
    }
  });

  // ===== 伺服器設定 =====
  app.get('/api/settings/:guildId', async (req, res) => {
    try {
      const s = await client.settings.get(req.params.guildId);
      res.json(s);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/settings/:guildId', async (req, res) => {
    try {
      const merged = await client.settings.replace(req.params.guildId, req.body);
      logger.info('panel', `已更新伺服器 ${req.params.guildId} 的設定`);
      res.json({ ok: true, settings: merged });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/settings/:guildId/reset', async (req, res) => {
    try {
      const def = await client.settings.reset(req.params.guildId);
      res.json({ ok: true, settings: def });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 資料庫瀏覽 =====
  app.get('/api/collections', (req, res) => {
    res.json(client.db.listCollections());
  });

  app.get('/api/collection/:name', (req, res) => {
    const col = client.db.collection(req.params.name);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const entries = col.all().slice(0, limit);
    res.json({ name: col.name, size: col.size(), entries });
  });

  app.get('/api/collection/:name/:key', (req, res) => {
    const col = client.db.collection(req.params.name);
    const value = col.get(req.params.key);
    if (value === undefined) return res.status(404).json({ error: 'not found' });
    res.json(value);
  });

  app.put('/api/collection/:name/:key', (req, res) => {
    try {
      client.db.collection(req.params.name).set(req.params.key, req.body);
      logger.info('panel', `已更新資料庫 ${req.params.name}/${req.params.key}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/collection/:name/:key', (req, res) => {
    const ok = client.db.collection(req.params.name).delete(req.params.key);
    if (!ok) return res.status(404).json({ error: 'not found' });
    logger.info('panel', `已刪除資料庫 ${req.params.name}/${req.params.key}`);
    res.json({ ok: true });
  });

  // ===== 即時日誌（SSE） =====
  app.get('/api/logs', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    for (const e of getHistory()) {
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    }
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (e) {
        /* ignore */
      }
    }, 20000);
    const unsubscribe = subscribe((e) => {
      try {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      } catch (e2) {
        /* ignore */
      }
    });
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // ===== 機器人控制 =====
  app.post('/api/bot/reload', async (req, res) => {
    try {
      const { loadCommands } = require('../core/commandHandler');
      const commandsDir = path.join(__dirname, '..', 'commands');
      for (const key of Object.keys(require.cache)) {
        if (key.startsWith(commandsDir)) delete require.cache[key];
      }
      client.commands.clear();
      await loadCommands(client);
      logger.info('panel', '已重新載入全部指令');
      res.json({ ok: true, count: client.commands.size });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/bot/flush', (req, res) => {
    client.db.flush();
    logger.info('panel', '已將資料庫寫入磁碟');
    res.json({ ok: true });
  });

  // ===== 備份 / 還原 =====
  app.get('/api/backup', (req, res) => {
    const collections = {};
    for (const c of client.db.listCollections()) {
      const col = client.db.collection(c.name);
      collections[c.name] = {};
      for (const entry of col.all()) {
        const { id, value, ...rest } = entry;
        collections[c.name][id] = Object.keys(rest).length > 0 ? rest : value;
      }
    }
    const payload = { exportedAt: new Date().toISOString(), bot: client.user?.tag || 'unknown', collections };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${Date.now()}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  });

  app.post('/api/restore', (req, res) => {
    try {
      const body = req.body || {};
      const collections = body.collections;
      if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
        return res.status(400).json({ error: '缺少 collections 物件' });
      }
      let count = 0;
      for (const [name, data] of Object.entries(collections)) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return res.status(400).json({ error: `collection「${name}」格式錯誤` });
        }
        client.db.collection(name).replaceAll(data);
        count += Object.keys(data).length;
      }
      logger.warn('panel', `已從備份還原 ${count} 筆資料（${Object.keys(collections).length} 個 collection）`);
      res.json({ ok: true, collections: Object.keys(collections).length, entries: count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 靜態頁面 =====
  app.use(express.static(path.join(__dirname, 'public')));

  return { app, token };
}

module.exports = { createPanel };
