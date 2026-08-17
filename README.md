# 🤖 多功能 Discord Bot

一個功能完整、開箱即用的 Discord 機器人，使用 **discord.js v14** 與 **Node.js** 打造。內建 20+ 功能模組、50+ 斜線指令，涵蓋社群伺服器從基礎到進階的所有需求。

## ✨ 功能總覽

| 分類 | 功能 | 說明 |
| --- | --- | --- |
| 🛡️ 驗證 | 按鈕驗證 | 在驗證頻道點擊按鈕即可獲得驗證身分組（`/verify setup`） |
| 👋 歡迎 | 歡迎/歡送訊息 | 成員加入/離開時發送可自訂的 Embed 訊息（`/welcome setup`） |
| 🎖️ 身分組 | 自動身分組 | 加入伺服器自動獲得身分組（`/autorole`） |
| 🎨 身分組 | 反應身分組 | 對訊息加表情自動獲得/移除身分組（`/reactionrole`） |
| 🤖 自動審核 | 髒話/敏感詞過濾 | 偵測並封鎖違規字詞（`/automod`） |
| 🤖 自動審核 | 邀請連結/外部連結封鎖 | 防止廣告連結 |
| 🤖 自動審核 | 全大寫/大量提及偵測 | 防止洗版 |
| 🤖 自動審核 | 反垃圾訊息 | 洗頻/重複訊息自動刪除、警告、禁言或封鎖 |
| 🤖 自動審核 | 反突襲（Anti-Raid） | 大量刪頻/封鎖時自動處罰 |
| 🎫 客服表單 | Ticket 系統 | 一鍵建立客服單、認領、關閉、轉錄存檔（`/ticket setup`） |
| 🛡️ 管理 | 完整管理指令 | ban / kick / timeout / warn / purge / slowmode / lockdown 等 |
| 📋 日誌 | 審計日誌 | 訊息刪改、成員進出、身分組變更、封鎖紀錄（`/logging`） |
| 📈 等級 | 等級系統 | 發言獲得經驗值、升級、等級身分組、排行榜（`/leveling`） |
| 💰 經濟 | 經濟系統 | 每日/每週獎勵、打工、乞討、轉帳、賭博、商店（`/economy`） |
| 🎉 抽獎 | 抽獎系統 | 一鍵抽獎、多人參加、自動抽選、重抽（`/giveaway start`） |
| 💡 建議 | 建議系統 | 建議頻道 + 大眾投票 + 管理員核准/拒絕（`/suggest setup`） |
| 📊 投票 | 投票系統 | 2-10 個選項的互動式投票（`/poll`） |
| 🔊 語音 | 臨時語音頻道 | 加入「建立頻道」自動生成私人語音房（`/tempvoice setup`） |
| 📈 統計 | 伺服器統計 | 成員/線上/加成數的即時統計頻道（`/stats setup`） |
| 🎂 生日 | 生日系統 | 設定生日、當天自動祝賀（`/birthday set`） |
| ⏰ 提醒 | 提醒系統 | 個人化定時提醒（`/remind me`） |
| 🌙 AFK | AFK 系統 | 設定 AFK 狀態、被提及自動通知（`/afk`） |
| ✍️ 自訂 | 自訂指令 | 管理員自訂文字指令（`/customcmd add`） |
| 🛠️ 實用 | 實用工具 | userinfo / serverinfo / avatar / banner / embed / translate 等 |
| 🎮 娛樂 | 娛樂指令 | 8ball / 骰子 / 猜拳 / 吐槽 / 情侶配對 等 |
| 🎵 音樂 | 音樂播放 | YouTube 播放、佇列、循環、音量控制（需 ffmpeg） |
| 🖥️ 網頁控制面板 | 瀏覽器儀表板 | 狀態監控、即時日誌、伺服器設定、資料庫編輯、備份還原 |

---

## 🖥️ 網頁控制面板

機器人內建一個**本地網頁控制面板**，用瀏覽器即可管理一切：

- **📊 狀態** — 上線狀態、延遲、運行時間、伺服器/使用者/指令數
- **📜 即時日誌** — 以 SSE 即時串流觀看機器人日誌（自動捲動）
- **🏠 伺服器 → ⚙️ 設定中心** — 每個功能一張卡片：勾選啟用、選頻道/身分組、按「儲存」即生效。驗證/客服有「📨 發送面板」按鈕、歡迎有「測試訊息」按鈕，上方還有「尚未設定」快速檢查清單。單一伺服器時自動進入
- **🗄️ 資料庫** — 瀏覽/編輯/刪除所有 collection（警告、經濟、等級、抽獎、客服、提醒等）
- **💾 備份** — 一鍵下載全部資料備份、上傳還原

### 使用方式

1. `.env` 設定（預設即啟用）：
   ```
   PANEL_ENABLED=true
   PANEL_HOST=127.0.0.1     # 僅本機可存取；要從其他裝置連線請改 0.0.0.0
   PANEL_PORT=3000
   PANEL_TOKEN=             # 留空則每次啟動自動產生（顯示於終端機）
   ```
2. 啟動機器人後，瀏覽器開啟 `http://127.0.0.1:3000`。
3. 輸入終端機顯示的 **Token**（建議在 `.env` 固定設定 `PANEL_TOKEN` 以免重啟後變更）。
4. 面板功能已就緒；「重新載入指令」可在不重啟機器人的情況下更新指令。

> ⚠️ 安全提醒：`PANEL_HOST` 預設只綁定本機。若改為 `0.0.0.0` 對外開放，**務必**設定一組強 Token。

---

## 🚀 快速開始

### 環境需求

- **Node.js 18.18+**（建議 20 LTS 或 22 LTS）
- 音樂功能需要系統安裝 **ffmpeg**（[下載教學](https://ffmpeg.org/download.html)，Windows 請加入 PATH）

### 安裝

```bash
npm install
```

### 設定

1. 複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

2. 填入你的 Bot Token 與 Client ID（取得方式見下節）。
3. 語言設定：`.env` 的 `LANG` 可選 `both`（中英雙語，預設）/ `zh`（僅中文）/ `en`（僅英文）。所有指令說明、回覆與功能訊息都會依此顯示。

### 啟動

```bash
npm start          # 啟動機器人
npm run dev        # 開發模式（檔案變更自動重啟）
npm run check      # 檢查所有檔案語法
npm run dry        # 乾跑：載入所有模組但不連線（測試用）
```

---

## 🔧 Discord 開發者後台設定

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** 建立應用程式。
2. 左側 **Bot** 分頁 → **Add Bot** 建立機器人 → **Reset Token** 複製 Token 填入 `.env` 的 `TOKEN`。
3. 在 **Bot** 分頁下方 **Privileged Gateway Intents** 開啟三個開關（本機器人需要）：
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**
   - ✅ **PRESENCE INTENT**
4. 左側 **OAuth2** 分頁 → 複製 **Client ID** 填入 `.env` 的 `CLIENT_ID`。
5. 邀請機器人：開啟下方連結（把 `CLIENT_ID` 換成你的）：

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

> `permissions=8` 為管理員權限（最省事）；若想最小權限，可改用 `permissions=275146342912`（完整管理+語音+訊息權限）。

6. 開發期間可在 `.env` 填上 `GUILD_ID`，指令會**立即**註冊到該伺服器；正式上線請留空（全域註冊需等待 1-2 小時生效）。

---

## 🎯 首次設定流程（建議順序）

在伺服器依序執行以下指令完成部署：

| 步驟 | 指令 | 說明 |
| --- | --- | --- |
| 1 | `/welcome setup channel:#頻道` | 設定歡迎訊息頻道 |
| 2 | `/verify setup channel:#驗證 channel:身分組` | 建立驗證面板（成員點按鈕獲得身分組） |
| 3 | `/autorole add role:@身分組` | 自動發放身分組 |
| 4 | `/ticket setup channel:#客服 category:分類` | 建立客服表單面板 |
| 5 | `/automod setup` | 啟用自動審核（之後可用 `/automod word` 加過濾字） |
| 6 | `/logging setup channel:#日誌` | 設定審計日誌頻道 |
| 7 | `/leveling setup` | 啟用等級系統 |
| 8 | `/suggest setup channel:#建議` | 設定建議頻道 |
| 9 | `/stats setup category:分類` | 建立統計頻道 |
| 10 | `/tempvoice setup channel:#建立房` | 啟用臨時語音頻道 |
| 11 | `/birthday channel channel:#頻道` | 設定生日公告頻道 |
| 12 | `/reactionrole add` | 建立反應身分組 |

所有設定指令都是 `adminOnly`（需要「管理伺服器」權限）。

---

## 📖 指令總表

> 完整指令列表請在 Discord 中使用 `/help` 查看（可依分類瀏覽）。

### 🛡️ 管理（moderation）
`/ban` `/kick` `/softban` `/unban` `/timeout` `/untimeout` `/warn` `/warnings` `/removewarn` `/clearwarns` `/purge` `/slowmode` `/lockdown` `/nick` `/role` `/vkick` `/vmute` `/vunmute` `/vdeafen` `/vundeafen`

### ⚙️ 伺服器設定（config）
`/welcome setup` `/welcome goodbye-setup` `/verify setup` `/autorole` `/reactionrole` `/automod` `/logging` `/leveling` `/economy` `/ticket setup` `/suggest setup` `/stats setup` `/tempvoice setup` `/customcmd`

### 🛠️ 實用工具（utility）
`/help` `/ping` `/botinfo` `/userinfo` `/serverinfo` `/avatar` `/banner` `/emoji` `/roleinfo` `/channelinfo` `/invite` `/uptime` `/translate` `/id` `/embed` `/poll` `/custom` `/afk` `/remind` `/birthday` `/rank` `/leaderboard`

### 💰 經濟（economy）
`/balance` `/rich` `/daily` `/weekly` `/work` `/beg` `/pay` `/coinflip` `/diceduel` `/slots` `/shop` `/buy`

### 🎉 抽獎與建議
`/giveaway start` `/giveaway end` `/giveaway reroll` `/giveaway list` `/giveaway cancel` `/suggest send`

### 🎵 音樂（music）
`/play` `/skip` `/stop` `/pause` `/resume` `/nowplaying` `/queue` `/loop` `/shuffle` `/volume` `/remove` `/clear` `/join` `/leave`

### 🎮 娛樂（fun）
`/8ball` `/dice` `/flip` `/rps` `/say` `/reverse` `/clap` `/mock` `/joke` `/ship` `/hug` `/roast`

---

## 🎵 音樂功能

音樂使用 `@discordjs/voice` + `play-dl`，**需要系統安裝 ffmpeg** 才能播放。

- Windows：下載 [ffmpeg](https://www.gyan.dev/ffmpeg/builds/)（essentials build）解壓後，把 `bin` 資料夾加入系統 PATH，重開終端機。
- macOS：`brew install ffmpeg`
- Linux：`sudo apt install ffmpeg`

驗證安裝：終端機輸入 `ffmpeg -version` 有輸出即成功。

---

## 📁 專案結構

```
├── src/
│   ├── index.js            # 入口
│   ├── config.js           # 環境設定
│   ├── core/               # 核心：client、指令/事件載入、設定管理、權限、冷卻
│   ├── database/           # JSON 資料庫 + 預設設定
│   ├── utils/              # 工具：logger、embeds、format、constants
│   ├── features/           # 功能模組（自動審核、客服、抽獎、音樂、臨時語音等）
│   ├── commands/           # 斜線指令（依分類資料夾）
│   └── events/             # 事件處理
├── data/                   # 執行時自動產生（設定/資料/轉錄檔，勿手動編輯）
├── scripts/check.js        # 語法檢查
└── .env.example
```

## 🗄️ 資料儲存

支援兩種資料庫，`.env` 的 `DB_TYPE` 切換（兩者 API 完全相容，功能程式碼不需修改）：

### 選項一：本地 JSON（預設）

所有資料以 JSON 檔儲存在 `data/` 目錄（已加入 `.gitignore`）：

| 檔案 | 內容 |
| --- | --- |
| `data/guilds.json` | 各伺服器設定 |
| `data/warns.json` | 警告紀錄 |
| `data/economy.json` | 經濟資料 |
| `data/levels.json` | 等級經驗 |
| `data/giveaways.json` | 抽獎紀錄 |
| `data/tickets.json` | 客服單紀錄 |
| `data/reminders.json` | 提醒 |
| `data/birthdays.json` | 生日 |
| `data/tempVoice.json` | 臨時語音紀錄 |
| `data/afk.json` | AFK 狀態 |
| `data/transcripts/` | 客服單轉錄檔 |

> ⚠️ 若用 Docker / Coolify 部署，**容器重啟會清空 `data/`**（沒有掛載持久化磁碟時）。請改用 MongoDB。

### 選項二：MongoDB（推薦用於 Docker / Coolify）

1. 到 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 註冊免費帳號，建立 **M0（Free）** 叢集
2. 建立 Database User 並取得連線字串（格式 `mongodb+srv://使用者:密碼@cluster.mongodb.net/`）
3. `.env` 設定：
   ```
   DB_TYPE=mongodb
   MONGODB_URI=mongodb+srv://使用者:密碼@cluster.mongodb.net/
   MONGODB_NAME=disocrd_bot
   ```
4. **遷移既有資料**（把目前 `data/` 的 JSON 匯入 MongoDB）：
   ```bash
   node scripts/migrate-json-to-mongo.js
   ```
5. 重啟機器人。之後所有資料（設定、經濟、等級、抽獎…）都存在雲端，**重啟不會消失**。

> MongoDB 連線失敗時會**自動退回本地 JSON**，機器人不會因此掛掉（終端機有警告）。

## ❓ 常見問題

**Q: 指令沒有出現？**
A: 確認 `.env` 有正確的 `CLIENT_ID` 與 `TOKEN`，且邀請連結包含 `applications.commands` scope。開發期間設 `GUILD_ID` 可即時生效；全域註冊需等待。

**Q: 機器人收不到訊息？**
A: 確認 Developer Portal 已開啟 **MESSAGE CONTENT INTENT**。

**Q: 身分組操作失敗？**
A: 機器人的角色必須在目標身分組**上方**，且機器人需要有「管理身分組」權限。

**Q: 音樂無法播放？**
A: 確認已安裝 ffmpeg 且 `ffmpeg -version` 可執行；確認機器人有語音權限。

---

## 📄 License

MIT
