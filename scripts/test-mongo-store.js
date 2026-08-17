/**
 * MongoDB 儲存後端邏輯測試：以模擬 MongoDB 驗證同步 API 與持久化路徑。
 * 用法：node scripts/test-mongo-store.js
 */
const { MongoStore } = require('../src/database/mongoStore');

/** 模擬 MongoDB：文件存於 Map */
function fakeMongoDb() {
  const docs = new Map(); // 'name:key' -> { _id, data }
  return {
    collection(name) {
      return {
        async updateOne(filter, update) {
          docs.set(`${name}:${filter._id}`, { _id: filter._id, data: update.$set.data });
        },
        async deleteOne(filter) {
          docs.delete(`${name}:${filter._id}`);
        },
        find() {
          const list = [...docs]
            .filter(([k]) => k.startsWith(`${name}:`))
            .map(([, d]) => d);
          return {
            async *[Symbol.asyncIterator]() {
              for (const d of list) yield d;
            },
          };
        },
      };
    },
  };
}

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};

(async () => {
  console.log('== 寫入與持久化 ==');
  const mongo = fakeMongoDb();
  const store = new MongoStore('mongodb://fake', 'test');
  store.mongoDb = mongo;
  const col = store.collection('guilds');
  col.set('g1', { name: '測試', count: 1 });
  col.update('g1', (cur) => ({ ...cur, count: cur.count + 1 }));
  col.set('g2', { name: '測試二' });
  check('記憶體中 set/update 正確', col.get('g1').count === 2 && col.size() === 2);
  await store.flush();

  console.log('== 重新載入（模擬重啟） ==');
  const store2 = new MongoStore('mongodb://fake', 'test');
  store2.mongoDb = mongo;
  const col2 = store2.collection('guilds');
  await col2.load();
  check('重載後資料一致', col2.get('g1').count === 2 && col2.get('g2').name === '測試二');
  check('all() 形狀正確', col2.all()[0].id === 'g1' && col2.all()[0].name === '測試');
  check('find/filter/keys 可用', col2.find((v) => v.name === '測試').count === 2 && col2.filter((v) => v.name.includes('測試')).length === 2 && col2.keys().length === 2);

  console.log('== 刪除與重載 ==');
  col2.delete('g1');
  await store2.flush();
  const store3 = new MongoStore('mongodb://fake', 'test');
  store3.mongoDb = mongo;
  const col3 = store3.collection('guilds');
  await col3.load();
  check('刪除已持久化', !col3.has('g1') && col3.size() === 1);

  console.log('== replaceAll（面板還原用） ==');
  col3.replaceAll({ x: { a: 1 }, y: { b: 2 } });
  check('replaceAll 生效', col3.size() === 2 && col3.get('x').a === 1);
  await store3.flush();
  const store4 = new MongoStore('mongodb://fake', 'test');
  store4.mongoDb = mongo;
  const col4 = store4.collection('guilds');
  await col4.load();
  check('replaceAll 已持久化', col4.get('y').b === 2 && !col4.has('g2'));

  console.log('== listCollections ==');
  check('listCollections 列出 guilds', store4.listCollections().some((c) => c.name === 'guilds' && c.size === 2));

  console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('測試失敗：', e);
  process.exit(1);
});
