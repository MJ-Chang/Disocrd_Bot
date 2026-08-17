/**
 * 控制面板 API 測試：以 mock client 啟動面板，實測各端點。
 * 用法：node scripts/test-panel.js
 */
const { createPanel } = require('../src/panel/server');
const { logger, getHistory } = require('../src/utils/logger');

/** 簡易 in-memory collection */
class FakeCol {
  constructor() { this.data = {}; }
  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; return v; }
  delete(k) { if (!(k in this.data)) return false; delete this.data[k]; return true; }
  size() { return Object.keys(this.data).length; }
  all() { return Object.entries(this.data).map(([id, v]) => (v && typeof v === 'object' ? { id, ...v } : { id, value: v })); }
  replaceAll(obj) { this.data = obj; return this.size(); }
}

/** 模擬 discord.js Collection（Map + map/filter） */
function fakeCache(entries = []) {
  const map = new Map(entries);
  return {
    size: map.size,
    get: (k) => map.get(k),
    has: (k) => map.has(k),
    values: () => map.values(),
    forEach: (fn) => map.forEach(fn),
    map: (fn) => [...map.values()].map(fn),
    filter: (fn) => [...map.values()].filter(fn),
  };
}

/** 模擬頻道 */
function chan(id, name, type) {
  return {
    id, name, type,
    isTextBased: () => type !== 4,
    isVoiceBased: () => type === 2,
    isCategory: () => type === 4,
    send: async () => ({ id: 'msg-' + id }),
    messages: { fetch: async () => null },
  };
}

/** 模擬身分組 */
function role(id, name) {
  return { id, name, color: 0, position: 1, managed: false, hoist: false };
}

/** mock client */
const cols = new Map();
const settingsStore = {};
const mockClient = {
  ready: true,
  startedAt: Date.now() - 1234567,
  user: { tag: 'TestBot#0001', username: 'TestBot', id: '111222333', displayAvatarURL: () => 'https://x/avatar.png' },
  ws: { ping: 42 },
  commands: {
    map: new Map(),
    get size() { return this.map.size; },
    has(k) { return this.map.has(k); },
    set(k, v) { this.map.set(k, v); },
    clear() { this.map.clear(); },
  },
  guilds: {
    cache: fakeCache([
      ['g1', {
        id: 'g1', name: '測試伺服器', memberCount: 123, ownerId: 'u1',
        iconURL: () => null, createdTimestamp: Date.now() - 999999,
        channels: { cache: fakeCache([
          ['c1', chan('c1', '一般', 0)],
          ['vc1', chan('vc1', '語音房', 2)],
          ['cat1', chan('cat1', '管理分類', 4)],
        ]) },
        roles: { cache: fakeCache([['r1', role('r1', '成員')]]) },
      }],
    ]),
  },
  users: { cache: fakeCache() },
  config: { panel: { token: 'testtoken' } },
  db: {
    collection(name) { if (!cols.has(name)) cols.set(name, new FakeCol()); return cols.get(name); },
    listCollections() { return [...cols].map(([name, c]) => ({ name, size: c.size() })); },
    flush() { return true; },
  },
  settings: {
    async get(id) { return settingsStore[id] || { name: 'Guild' }; },
    async replace(id, obj) { settingsStore[id] = obj; return obj; },
    async reset(id) { settingsStore[id] = { defaults: true }; return settingsStore[id]; },
    async set(id, path, value) {
      const s = settingsStore[id] || (settingsStore[id] = {});
      const parts = String(path).split('.');
      let cur = s;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return s;
    },
  },
};

(async () => {
  let pass = 0;
  let fail = 0;
  const check = (name, cond) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`); }
  };

  const { app } = createPanel(mockClient);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const A = { headers: { Authorization: 'Bearer testtoken' } };
  const J = { headers: { Authorization: 'Bearer testtoken', 'Content-Type': 'application/json' } };
  const Q = `?token=testtoken`;

  console.log('== 驗證 ==');
  let r = await fetch(`${base}/api/status`);
  check('無 Token 回傳 401', r.status === 401);
  r = await fetch(`${base}/api/status?token=wrong`);
  check('錯誤 Token 回傳 401', r.status === 401);

  console.log('== 狀態 ==');
  r = await fetch(`${base}/api/status${Q}`);
  const status = await r.json();
  check('狀態 200', r.status === 200);
  check('狀態含 online/uptime', status.online === true && typeof status.uptimeMs === 'number');
  check('狀態含指令數', typeof status.commands === 'number' && status.commands >= 0);

  console.log('== 靜態頁面 ==');
  r = await fetch(`${base}/`);
  const html = await r.text();
  check('首頁 200 且為 HTML', r.status === 200 && html.includes('控制面板'));

  console.log('== 伺服器 ==');
  r = await fetch(`${base}/api/guilds${Q}`);
  const guilds = await r.json();
  check('伺服器清單 200', r.status === 200 && guilds.length === 1);
  r = await fetch(`${base}/api/guild/g1/channels${Q}`);
  check('頻道清單 200', r.status === 200);
  r = await fetch(`${base}/api/guild/nonexist/channels${Q}`);
  check('不存在的伺服器 404', r.status === 404);

  console.log('== 設定讀寫 ==');
  r = await fetch(`${base}/api/settings/g1`, { method: 'PUT', ...J, body: JSON.stringify({ welcome: { enabled: true, channel: 'c1' }, verify: { role: 'r1' } }) });
  const put = await r.json();
  check('PUT 設定 200', r.status === 200 && put.ok === true);
  r = await fetch(`${base}/api/settings/g1${Q}`);
  const got = await r.json();
  check('讀回設定正確', got.welcome.enabled === true && got.welcome.channel === 'c1' && got.verify.role === 'r1');
  r = await fetch(`${base}/api/settings/g1`, { method: 'PUT', ...J, body: JSON.stringify('bad') });
  check('PUT 非物件被拒', r.status === 400);
  // 消耗錯誤 body 避免後續處理
  await r.text().catch(() => {});
  r = await fetch(`${base}/api/settings/g1/reset`, { method: 'POST', ...A });
  const reset = await r.json();
  check('重設設定 200', r.status === 200 && reset.ok === true);

  console.log('== 設定中心動作 ==');
  r = await fetch(`${base}/api/guild/g1${Q}`);
  const ginfo = await r.json();
  check('伺服器資訊 200', r.status === 200 && ginfo.name === '測試伺服器');
  r = await fetch(`${base}/api/guild/g1/verify/send`, { method: 'POST', ...A });
  check('未設定驗證 → 400', r.status === 400);
  settingsStore.g1 = { verify: { enabled: true, channel: 'c1', role: 'r1', panelMessage: null, buttonLabel: null, message: null } };
  r = await fetch(`${base}/api/guild/g1/verify/send`, { method: 'POST', ...A });
  const vsend = await r.json();
  check('發送驗證面板 200', r.status === 200 && vsend.ok === true);
  r = await fetch(`${base}/api/guild/g1/tickets/send`, { method: 'POST', ...A });
  check('未設定客服 → 400', r.status === 400);
  r = await fetch(`${base}/api/guild/g1/welcome/test`, { method: 'POST', ...J, body: JSON.stringify({}) });
  check('測試歡迎訊息無頻道 → 400', r.status === 400);
  r = await fetch(`${base}/api/guild/g1/welcome/test`, { method: 'POST', ...J, body: JSON.stringify({ channel: 'c1' }) });
  check('測試歡迎訊息 200', r.status === 200);
  r = await fetch(`${base}/api/guild/g1/stats/setup`, { method: 'POST', ...J, body: JSON.stringify({}) });
  check('統計頻道無分類 → 400', r.status === 400);

  console.log('== 資料庫 ==');
  r = await fetch(`${base}/api/collection/demo/k1`, { method: 'PUT', ...J, body: JSON.stringify({ count: 5 }) });
  check('PUT collection 200', r.status === 200);
  r = await fetch(`${base}/api/collections${Q}`);
  const colsList = await r.json();
  check('collections 列出 demo', colsList.some((c) => c.name === 'demo' && c.size === 1));
  r = await fetch(`${base}/api/collection/demo/k1${Q}`);
  check('讀回 collection 值', r.status === 200 && (await r.json()).count === 5);
  r = await fetch(`${base}/api/collection/demo/missing${Q}`);
  check('不存在的 key 404', r.status === 404);
  r = await fetch(`${base}/api/collection/demo/k1`, { method: 'DELETE', ...A });
  check('DELETE collection 200', r.status === 200);

  console.log('== 備份 / 還原 ==');
  cols.get('demo').set('x', { a: 1 });
  r = await fetch(`${base}/api/backup`, A);
  const backup = await r.json();
  check('備份 200 且含資料', r.status === 200 && backup.collections.demo && backup.collections.demo.x.a === 1);
  r = await fetch(`${base}/api/restore`, { method: 'POST', ...J, body: JSON.stringify({ collections: { demo: { y: { b: 2 } } } }) });
  const restored = await r.json();
  check('還原 200', r.status === 200 && restored.ok === true && restored.entries === 1);
  check('還原後資料正確', cols.get('demo').get('y').b === 2 && !cols.get('demo').get('x'));
  r = await fetch(`${base}/api/restore`, { method: 'POST', ...J, body: JSON.stringify({ collections: { demo: 'bad' } }) });
  check('還原格式錯誤被拒', r.status === 400);

  console.log('== 機器人控制 ==');
  r = await fetch(`${base}/api/bot/flush`, { method: 'POST', ...A });
  check('flush 200', r.status === 200);
  r = await fetch(`${base}/api/bot/reload`, { method: 'POST', ...A });
  check('reload 200', r.status === 200 && (await r.json()).ok === true);

  console.log('== 即時日誌 SSE ==');
  logger.info('panel-test', '測試日誌訊息 abc123');
  const ctrl = new AbortController();
  r = await fetch(`${base}/api/logs${Q}`, { signal: ctrl.signal });
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let all = '';
  let found = false;
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    all += decoder.decode(chunk, { stream: true });
    if (all.includes('abc123')) { found = true; break; }
  }
  check('SSE 200 且串流含歷史日誌', r.status === 200 && found);
  ctrl.abort();

  console.log('== 日誌歷史 ==');
  check('getHistory 包含測試訊息', getHistory().some((e) => e.msg.includes('abc123')));

  server.close();
  console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('測試執行失敗：', e);
  process.exit(1);
});
