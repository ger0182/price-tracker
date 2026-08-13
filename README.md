# 🛒 滿意寶寶 PChome 價格追蹤器

PChome 商品價格追蹤工具，使用 **Vercel Serverless Function + Vercel Cron Jobs + LINE Messaging API** 自動查價與通知。

目前追蹤商品：**滿意寶寶 純水99濕巾｜補充包 24包組**

- 查價網站：https://price-tracker-sigma-lime.vercel.app/
- 商品頁：https://24h.pchome.com.tw/prod/DAAT0R-1900GIZXQ
- 自動排程：每天台灣時間約 **10:13、16:13**
- 低價警報門檻：**價格 < NT$999**

---

## ✨ 功能

- `api/price.js`：Vercel Serverless Function，查詢 PChome 價格、原價與庫存
- `api/cron-price.js`：Vercel Cron 專用入口
- 每天自動查價兩次
- 每次查價後透過 LINE Messaging API Broadcast 發送結果
- 價格 **低於 NT$999** 時額外加發 🔥 低價警報
- 查價失敗時也會透過 LINE 發送警告
- 網頁仍可手動查價並保存瀏覽器 `localStorage` 歷史

---

## 🧩 系統架構

```text
Vercel Cron Jobs
02:13 UTC / 08:13 UTC
= 台灣 10:13 / 16:13
        │
        ▼
/api/cron-price
        │
        ├── 驗證 CRON_SECRET
        │
        ▼
/api/price
        │
        ▼
PChome 商品 API / 商品頁備援解析
        │
        ▼
LINE Messaging API Broadcast
        │
        └── 價格 < 999 時額外發送低價警報
```

GitHub Actions 已不再負責固定排程，避免與 Vercel Cron 重複執行。

---

## ⏰ Vercel Cron 排程

排程設定在：

```text
vercel.json
```

目前設定：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron-price",
      "schedule": "13 2 * * *"
    },
    {
      "path": "/api/cron-price",
      "schedule": "13 8 * * *"
    }
  ]
}
```

Vercel Cron 使用 UTC：

- `02:13 UTC` → 台灣時間 `10:13`
- `08:13 UTC` → 台灣時間 `16:13`

> Hobby 方案的 Cron 執行時間可能不是精準到指定分鐘，但會依上述 daily schedule 執行。

---

## 🔐 Vercel Environment Variables

請在 Vercel Project：

**Settings → Environment Variables**

新增以下兩個變數，並至少套用到 **Production**：

### `LINE_CHANNEL_ACCESS_TOKEN`

填入 LINE Developers / Messaging API Channel 的 Channel Access Token。

```text
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
```

### `CRON_SECRET`

建立一組夠長的隨機字串，例如 32 bytes 以上。

```text
CRON_SECRET=一組長且隨機的秘密字串
```

Vercel Cron 觸發時會帶入：

```text
Authorization: Bearer <CRON_SECRET>
```

`api/cron-price.js` 會驗證此 Header，避免任何人直接呼叫 Cron API 造成 LINE 廣播。

設定完 Environment Variables 後，請重新部署 Production。

---

## 💬 LINE Broadcast

一般通知範例：

```text
🔎 商品價格自動檢查
滿意寶寶 純水99濕巾｜補充包 24包組

目前價格：NT$999
原價：NT$2,028
庫存：❌ 無庫存
檢查時間：2026/08/13 10:13
```

低價判斷：

```text
NT$999 → 一般通知
NT$998 → 一般通知 + 🔥低價警報
NT$899 → 一般通知 + 🔥低價警報
```

條件是：

```text
price < 999
```

不是 `<= 999`。

---

## 🧪 測試 Cron

正式 Cron endpoint：

```text
/api/cron-price
```

因為它受到 `CRON_SECRET` 保護，直接從瀏覽器開啟會得到 `401 Unauthorized`，這是正常的。

可使用 Vercel CLI 測試已部署的 Cron：

```bash
vercel crons ls
vercel crons run /api/cron-price
```

也可以在 Vercel Dashboard 查看 Functions / Runtime Logs，確認查價與 LINE Broadcast 執行結果。

---

## 📈 價格歷史

網頁的手動查價仍會保存到目前瀏覽器的 `localStorage`。

先前 GitHub Actions 自動保存的共享歷史仍保留在：

```text
price-data branch / price-history.json
```

但因為固定排程已搬到 Vercel，**Vercel Cron 目前不會繼續修改 GitHub 的 `price-data` branch**。

如果要讓 Vercel 自動查價也繼續累積跨裝置共享歷史，建議下一步改用 **Vercel Blob** 保存 `price-history.json`，不需要讓 Vercel 持有 GitHub 寫入 Token。

---

## 🖥️ 網頁手動查價

網頁仍可直接按：

```text
🔍 立即查詢價格
```

手動查詢會呼叫：

```text
/api/price
```

並更新目前瀏覽器的價格歷史與走勢。

---

## 🔧 本機開發

```bash
npm install
npm run dev
```

如果需要同時測試 Vercel Serverless Functions：

```bash
npm i -g vercel
vercel dev
```

---

## 📁 主要檔案

```text
price-tracker/
├── api/
│   ├── price.js          # PChome 查價 API
│   └── cron-price.js     # Vercel Cron + LINE Broadcast
├── src/
│   ├── App.jsx           # React 查價介面與價格走勢
│   └── main.jsx          # 載入共享/本機歷史並啟動 React
├── vercel.json           # Vercel Cron schedules
├── .env.example          # Vercel 環境變數範例
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 🔒 安全性

- `LINE_CHANNEL_ACCESS_TOKEN` 只放在 Vercel Environment Variables
- `CRON_SECRET` 只放在 Vercel Environment Variables
- 不要將任何真實 Token commit 到 GitHub
- `/api/cron-price` 必須通過 `Authorization: Bearer <CRON_SECRET>` 驗證
- `/api/price` 只負責查價，不包含 LINE Token
