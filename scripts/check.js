/**
 * 語法檢查腳本：對 src 與 scripts 下所有 .js 執行 `node --check`
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const roots = [path.join(__dirname, '..', 'src'), __dirname];
const files = roots.flatMap((r) => walk(r)).filter((f) => f.endsWith('.js'));
let failed = 0;

console.log(`檢查 ${files.length} 個 JavaScript 檔案…`);

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    failed += 1;
    const msg = String(e.stderr || e.message);
    console.error(`✗ ${path.relative(path.join(__dirname, '..'), file)}\n  ${msg.split('\n').slice(0, 4).join('\n  ')}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 個檔案語法錯誤！`);
  process.exit(1);
}
console.log('\n全部檔案語法正確 ✓');
