/**
 * 指令結構驗證：在註冊前檢查所有斜線指令是否符合 Discord 的硬性規則，
 * 避免「註冊失敗 → 指令永遠不更新」的悲劇。
 * 檢查項目：
 *  1. 必填選項必須排在可選選項之前（Discord 拒絕：APPLICATION_COMMAND_OPTIONS_REQUIRED_INVALID）
 *  2. 描述長度 <= 100 字元
 *  3. 指令名稱格式（小寫英文/數字/底線/連字號，<= 32）
 * 用法：npm run validate
 */
const path = require('path');
const fs = require('fs');

const commandsDir = path.join(__dirname, '..', 'src', 'commands');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

function validateOptions(options, file, errors, where) {
  let seenOptional = false;
  for (const o of options || []) {
    if (o.required) {
      if (seenOptional) {
        errors.push(`${file} → ${where}「${o.name}」：必填選項排在可選選項之後（Discord 會拒絕註冊）`);
      }
    } else {
      seenOptional = true;
    }
    if (o.description && o.description.length > 100) {
      errors.push(`${file} → ${where}「${o.name}」：描述 ${o.description.length} 字元，超過 100 上限`);
    }
    if (o.options && o.options.length) {
      validateOptions(o.options, file, errors, `${where}${o.name} > `);
    }
  }
}

function validateCommand(json, file, errors) {
  if (!/^[a-z0-9-_]{1,32}$/.test(json.name || '')) {
    errors.push(`${file} → 指令名稱格式錯誤：${json.name}`);
  }
  if (json.description && json.description.length > 100) {
    errors.push(`${file} → /${json.name} 描述 ${json.description.length} 字元，超過 100 上限`);
  }
  validateOptions(json.options || [], file, errors, `/${json.name} > `);
}

async function main() {
  const files = walk(commandsDir).filter((f) => f.endsWith('.js'));
  const errors = [];
  let count = 0;

  for (const f of files) {
    try {
      const mod = require(f);
      const defs = Array.isArray(mod) ? mod : [mod];
      for (const d of defs) {
        if (!d || !d.data) continue;
        count += 1;
        validateCommand(d.data.toJSON(), path.relative(path.join(__dirname, '..'), f), errors);
      }
    } catch (e) {
      errors.push(`${f}：載入失敗 ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`✗ 驗證失敗（共 ${count} 個指令，${errors.length} 個問題）：`);
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log(`✓ 指令結構驗證通過（${count} 個指令，無必填/可選排序問題）`);
  process.exit(0);
}

main();
