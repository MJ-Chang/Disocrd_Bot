/**
 * MongoDB 連線診斷 + 資料摘要工具。
 * 用法：node scripts/check-mongo.js
 * 會測試連線、列出各 collection 筆數，並驗證 guilds 設定是否完整。
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoStore } = require('../src/database/mongoStore');

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_NAME || 'disocrd_bot';
  if (!uri) {
    console.log('❌ 未設定 MONGODB_URI（目前使用本地 JSON 儲存）。');
    process.exit(0);
  }

  const store = new MongoStore(uri, dbName);
  await store.init();

  console.log(`\n📦 資料庫 ${dbName} 摘要：`);
  for (const c of store.listCollections()) {
    const col = store.collection(c.name);
    if (col.size() === 0) continue;
    const keys = col.keys().slice(0, 3);
    console.log(`  ✓ ${c.name}: ${c.size} 筆 ${keys.length ? '（ex: ' + keys.join(', ') + '）' : ''}`);
    if (c.name === 'guilds' && col.size() > 0) {
      const g = col.get(keys[0]);
      console.log(`     驗證 verify: ${g.verify?.enabled ? '✅ 啟用' : '❌ 停用'} ｜ 歡迎 welcome: ${g.welcome?.enabled ? '✅ 啟用' : '❌ 停用'} ｜ 客服 tickets: ${g.tickets?.enabled ? '✅ 啟用' : '❌ 停用'}`);
    }
  }
  console.log('\n✅ 連線與載入正常。');
  await store.close();
  process.exit(0);
})().catch((e) => {
  console.error('❌ 檢查失敗：', e.message);
  process.exit(1);
});
