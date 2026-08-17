/**
 * MongoDB 連線診斷（在 Coolify/Docker 容器內執行找出真正原因）。
 *
 * 用法（在 Coolify 應用程式的 Logs/Terminal，或本機）：
 *   node scripts/debug-mongo-connection.js
 *
 * 會依序檢查：DNS 伺服器 → SRV 解析 → TXT 解析 → 各 shard 的 TCP 連線 → 實際 MongoClient 連線，
 * 並輸出每一步的明確結果，方便判斷問題在哪一層。
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const dns = require('dns');
const net = require('net');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME || 'disocrd_bot';

function hostOf(uri) {
  const m = /^mongodb(\+srv)?:\/\/[^@]*@([^/]+)/.exec(uri) || /^mongodb(\+srv)?:\/\/([^/]+)/.exec(uri);
  return m ? { srv: !!m[1], host: m[2] } : null;
}

function testTcp(host, port, timeout = 6000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port, timeout });
    sock.once('connect', () => { sock.destroy(); resolve('✅ 可連線'); });
    sock.once('timeout', () => { sock.destroy(); resolve('❌ 逾時（防火牆/路由可能阻擋）'); });
    sock.once('error', (e) => { sock.destroy(); resolve(`❌ ${e.code || e.message}`); });
  });
}

(async () => {
  console.log('========================================');
  console.log('MongoDB 連線診斷');
  console.log('========================================');
  if (!uri) { console.log('❌ 未設定 MONGODB_URI（請在環境變數/ .env 設定）'); process.exit(1); }
  console.log(`URI：${uri.replace(/\/\/[^@]+@/, '//***@')}`);
  const info = hostOf(uri);
  console.log(`類型：${info.srv ? 'mongodb+srv（需要 SRV DNS）' : 'mongodb（直連）'}`);
  console.log(`主機：${info.host}`);

  console.log('\n【1】目前 DNS 伺服器（Node c-ares 用）：', dns.getServers().join(', ') || '（系統預設）');

  console.log('\n【2】SRV 解析：');
  try {
    const srv = await dns.promises.resolveSrv(`_mongodb._tcp.${info.host}`);
    console.log('  ✅ SRV 解析成功：');
    for (const s of srv) console.log(`     ${s.name}:${s.port}`);
    console.log('\n【3】TXT（replicaSet / authSource）：');
    try {
      const txt = await dns.promises.resolveTxt(`_mongodb._tcp.${info.host}`);
      console.log('  ' + txt.map((a) => a.join('')).join('\n  '));
    } catch (e) { console.log(`  ⚠️ TXT 解析失敗：${e.code} ${e.message}`); }

    console.log('\n【4】各 shard 的 TCP 連線測試（27017）：');
    for (const s of srv) {
      const r = await testTcp(s.name, s.port);
      console.log(`  ${s.name}:${s.port} → ${r}`);
    }
  } catch (e) {
    console.log(`  ❌ SRV 解析失敗：${e.code} ${e.message}`);
    console.log('     → 這是 DNS 層的問題（不是帳號密碼問題）');
  }

  console.log('\n【5】實際 MongoClient 連線：');
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    await client.connect();
    const db = client.db(dbName);
    const names = await db.listCollections().toArray();
    console.log(`  ✅ 連線成功！資料庫 ${dbName}，${names.length} 個 collection`);
    await client.close();
  } catch (e) {
    console.log(`  ❌ 連線失敗：${e.code || e.name || ''} ${e.message}`);
    if (/timed out/i.test(e.message)) console.log('     → 可能是網路層：VPS 無法連到 Atlas（防火牆/路由）');
    if (/querySrv|queryTxt|ENOTFOUND/i.test(e.message)) console.log('     → 可能是 DNS 層：容器 DNS 無法解析 Atlas 主機');
    if (/Authentication|auth/i.test(e.message)) console.log('     → 可能是帳號密碼或 IP 白名單問題');
  }
  console.log('\n診斷結束。把以上輸出貼給開發者即可定位問題。');
  process.exit(0);
})().catch((e) => { console.error('診斷失敗：', e); process.exit(1); });
