/**
 * 資料遷移：將本地 JSON 資料（data/*.json）匯入 MongoDB。
 * 用法：
 *   1. 在 .env 設定 MONGODB_URI（與 DB_TYPE=mongodb）
 *   2. node scripts/migrate-json-to-mongo.js
 * 執行後原 JSON 檔不會被刪除（可先保留當備份）。
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { ensureDnsWorks } = require('../src/database/mongoStore');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dataDir = path.join(__dirname, '..', 'data');
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME || 'disocrd_bot';

if (!uri) {
  console.error('❌ 找不到 MONGODB_URI，請先在 .env 設定 MongoDB Atlas 的連線字串。');
  process.exit(1);
}

(async () => {
  console.log('📁 讀取 data/ 目錄…');
  const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) {
    console.log('（沒有 JSON 資料可遷移，結束）');
    process.exit(0);
  }

  console.log(`🔌 連線 MongoDB（${uri.replace(/\/\/[^@]+@/, '//***@')}）…`);
  await ensureDnsWorks(uri);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const mongo = client.db(dbName);

  let total = 0;
  for (const file of files) {
    const name = file.replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    const entries = Object.entries(raw);
    const col = mongo.collection(name);
    if (entries.length > 0) {
      const docs = entries.map(([id, data]) => ({ _id: id, data }));
      await col.bulkWrite(
        docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } }))
      );
    }
    total += entries.length;
    console.log(`  ✓ ${name}: ${entries.length} 筆`);
  }

  await client.close();
  console.log(`\n✅ 遷移完成，共 ${files.length} 個 collection、${total} 筆資料。`);
  console.log('接著請在 .env 設定 DB_TYPE=mongodb 後重啟機器人。');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 遷移失敗：', e.message);
  process.exit(1);
});
