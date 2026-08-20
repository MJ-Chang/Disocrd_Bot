# 架構文件（子代理必讀）

這是本 Discord Bot 的介面合約。所有子代理**必須**嚴格依照此文件與既有範例檔案實作，否則會造成整合失敗。

## 專案概覽

- **技術棧**：Node.js（>=18.18）、discord.js **v14**、CommonJS（`require` / `module.exports`，**禁止** ESM / TypeScript）
- **語言**：所有使用者可見訊息使用**繁體中文**
- **資料庫**：自製 JSON store（`src/database/index.js`），無需安裝資料庫
- **入口**：`src/index.js` → 載入 `src/commands/**` 與 `src/events/**` → 登入

## 目錄結構

```
src/
├── index.js              入口（勿動）
├── config.js             環境設定（勿動）
├── core/
│   ├── client.js         Discord Client 工廠（勿動）
│   ├── commandHandler.js 指令載入/註冊（勿動）
│   ├── eventHandler.js   事件載入（勿動）
│   ├── settings.js       伺服器設定管理（勿動）
│   ├── permissions.js    權限工具（勿動，但可 require 使用）
│   └── cooldowns.js      冷卻工具（勿動）
├── database/
│   ├── index.js          JSON store（勿動）
│   └── defaults.js       預設設定（勿動）
├── utils/
│   ├── logger.js         logger.debug/info/warn/error(tag, ...msg)
│   ├── constants.js      Colors, Emojis, CategoryLabels, InviteRegex, LinkRegex
│   ├── format.js         parseDuration, formatDuration, formatNumber, discordTimestamp 等
│   └── embeds.js         info/success/error/warn/safeReply/sendError/sendSuccess/embedFromData
├── features/             功能模組（你的主要產出）
├── commands/             斜線指令（你的主要產出）
└── events/               事件（部分由你產出）
```

## 指令模組介面（commands/）

每個檔案 export 一個物件（或**陣列**以支援多個指令）：

```js
const { SlashCommandBuilder } = require('discord.js');
const { sendSuccess, sendError } = require('../../utils/embeds');

module.exports = {
  category: 'moderation',          // 分類：moderation|config|utility|economy|leveling|tickets|giveaways|suggestions|fun|music|voice
  data: new SlashCommandBuilder()
    .setName('kick')                // 名稱只能小寫英文+數字
    .setDescription('踢出成員')
    .addUserOption((o) => o.setName('user').setDescription('要踢出的成員').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('原因')),
  cooldown: 3000,                   // 可選，毫秒
  modOnly: true,                    // 可選：需要管理權限（另有 adminOnly、ownerOnly）
  async run(interaction, client) {
    // 實作。可 interaction.reply / interaction.deferReply() 後 editReply
  },
};
```

**規則**：
- 檔案路徑：`src/commands/<分類資料夾>/<名稱>.js`，例如 `src/commands/moderation/kick.js`。**路徑已由任務指定，不要自行更動或新增其他檔案**。
- 每個指令的 `data.name` 必須全小寫、不得與其他指令重複。
- 互動失敗時回覆 `sendError(interaction, '說明')`；成功可 `sendSuccess(interaction, '說明')`。
- 需要管理權限的指令設定 `modOnly: true`（勿在 run 內自行檢查）。
- 管理類指令務必用 `require('../../core/permissions')` 的 `canManageMember(interaction, target)` 檢查目標能否被操作，並用 `requireBotPerm` 檢查機器人權限。

## 事件模組介面（events/）

```js
module.exports = {
  name: 'guildMemberAdd',        // discord.js 事件名稱
  once: false,                   // 可選
  async run(client, ...args) {   // 第一個參數固定是 client
    // 實作
  },
};
```

## 功能模組介面（features/）

每個功能模組可選 export 以下函式（**都必須 try/catch 保護，不能讓錯誤外洩**）：

```js
module.exports = {
  async onReady(client) {},                       // 開機初始化（還原計時器、刷新等）
  async handleButton(client, interaction) {},     // 處理按鈕；處理了回傳 true
  async handleSelectMenu(client, interaction) {}, // 處理下拉選單；處理了回傳 true
  async handleModal(client, interaction) {},      // 處理 Modal；處理了回傳 true
};
```

**customId 約定**：一律用 `功能前綴:動作[:參數]`，例如 `ticket:open`、`ticket:close:123456`、`giveaway:enter`、`tv:rename`。不同功能請勿共用前綴（`ticket`、`giveaway`、`tv`、`suggest`、`verify`、`poll`、`music` 已被保留）。

## 常用工具 API（重要！請照此使用）

### embeds（`src/utils/embeds.js`）
```js
const { info, success, error, warn, sendError, sendSuccess, safeReply, withFooter } = require('../../utils/embeds');
// info(title, description) 回傳 EmbedBuilder；sendError(interaction, msg) 自動處理 ephemeral
// withFooter(embed, client) 加上機器人頁尾
```

### format（`src/utils/format.js`）
```js
const { parseDuration, formatDuration, formatNumber, formatCompact, discordTimestamp, formatDateTime, chunk, randomInt, sample } = require('../../utils/format');
// parseDuration('1h30m') -> 毫秒 | null；formatDuration(ms) -> '1 小時 30 分'
// discordTimestamp(ms, 'R') -> Discord 相對時間
```

### 設定（`src/core/settings.js`）
```js
const s = await client.settings.get(guildId);          // 整個設定物件
await client.settings.set(guildId, 'welcome.channel', channelId);
await client.settings.update(guildId, (s) => { s.autoroles.push(roleId); });
const v = await client.settings.getPath(guildId, 'automod.spamThreshold', 5);
```
設定結構見 `src/database/defaults.js`（已含所有功能的預設欄位）。

### 資料庫（`src/database/index.js`）
```js
const col = client.db.collection('warns');   // collection 名稱請用功能名（warns/economy/levels/giveaways/tickets/tempVoice/birthdays/reminders）
col.set('guildId:userId', { count: 1 });
col.get(key); col.has(key); col.delete(key);
col.update(key, (cur) => ({ ...cur, count: (cur?.count || 0) + 1 }), { count: 0 });
col.filter((v) => v.guildId === guildId);
```

### 權限（`src/core/permissions.js`）
```js
const { isAdmin, isModerator, canManageMember, requireBotPerm } = require('../../core/permissions');
```

### 常數（`src/utils/constants.js`）
`Colors.SUCCESS` 等、`Emojis.check` 等、`CategoryLabels`、`InviteRegex`、`LinkRegex`。

## 必須遵守的慣例

1. **只寫分配給你的檔案**。絕對不要修改：`src/core/**`、`src/database/**`、`src/utils/**`、`src/config.js`、`src/index.js`、`src/events/ready.js`、`src/events/interactionCreate.js`、`src/events/messageCreate.js`、`src/events/voiceStateUpdate.js`、`package.json`、`scripts/**`、`README.md`、`ARCHITECTURE.md`。
2. 若你的功能需要新的資料 collection，直接用 `client.db.collection('名稱')` 即可（自動建立）。
3. 所有非同步錯誤都要自己 try/catch；對使用者顯示友善的繁中錯誤訊息。
4. 使用 discord.js v14 API：`EmbedBuilder`、`ButtonBuilder`、`ActionRowBuilder`、`StringSelectMenuBuilder`、`ModalBuilder`、`TextInputBuilder`、`PermissionFlagsBits`、`ChannelType`、`Events`。
5. 管理功能（ban/kick/timeout/warn/purge/lockdown 等）需要檢查：使用者權限（設定 `modOnly: true` 或 adminOnly）、機器人權限（`requireBotPerm`）、目標可否管理（`canManageMember`）、目標不可高於機器人角色、不可對管理員操作。
6. 訊息字串一律繁體中文；embed 標題簡短有力。
7. **完成後**對自己寫的每個檔案執行 `node --check <檔案>` 確認語法正確。
8. 不要執行 `npm install`、不要啟動機器人、不要登入 Discord。
9. 不要刪除任何既有檔案。