# 🛒 滿意寶寶 PChome 價格追蹤器

PChome 商品價格追蹤工具，使用 **Vercel Serverless Function + GitHub Actions + LINE Messaging API** 自動查價與通知。

目前追蹤商品：**滿意寶寶 純水99濕巾｜補充包 24包組**

- 查價網站：https://price-tracker-sigma-lime.vercel.app/
- 商品頁：https://24h.pchome.com.tw/prod/DAAT0R-1900GIZXQ
- 自動排程：每天 **10:13、16:13（Asia/Taipei）**
- 低價警報門檻：**價格 < NT$999**

---

## ✨ 功能

- 透過 Vercel `/api/price` 在伺服器端查詢 PChome 商品價格
- 顯示目前售價、原價、庫存與價格走勢
- GitHub Actions 每天自動查價兩次
- 每次自動查價後透過 LINE Messaging API Broadcast 發送結果
- 顯示與上一次自動查價相比的漲跌金額
- 價格 **低於 NT$999** 時額外發送醒目的 🔥 低價警報
- 自動查價紀錄保存在 `price-data` branch，最多保留最近 180 筆
- 網頁啟動時會載入共享歷史，並與目前瀏覽器的 `localStorage` 紀錄合併
- 查價失敗時也會透過 LINE 發出警告
- GitHub Actions 支援手動 `Run workflow` 測試

---

## 🧩 系統架構

```text
GitHub Actions
每天 10:13 / 16:13（Asia/Taipei）
        │
        ▼
Vercel /api/price
        │
        ▼
PChome 商品 API / 商品頁備援解析
        │
        ├──► LINE Broadcast
        │      └── 價格 < 999 時再加發低價警報
        │
        └──► price-data branch
               └── price-history.json
                       │
                       ▼
                  Vercel 網頁
                  價格歷史 / 走勢
```

---

## 🚀 Vercel 部署

本專案是 Vite + React，並使用 `api/price.js` 作為 Vercel Serverless Function。

1. 將 repository 匯入 Vercel。
2. Framework / Build 設定可使用 Vercel 自動偵測。
3. 部署完成後確認以下網址可正常回傳 JSON：

```text
https://price-tracker-sigma-lime.vercel.app/api/price
```

價格查詢本身不需要第三方 API Key。

---

## ⏰ GitHub Actions 自動查價

Workflow：

```text
.github/workflows/price-check-line.yml
```

目前排程：

```yaml
schedule:
  - cron: '13 10,16 * * *'
    timezone: 'Asia/Taipei'
```

因此每天會在台灣時間：

- 10:13
- 16:13

自動執行查價。刻意避開整點，以降低 GitHub Actions scheduled workflow 在高負載時段延遲或漏跑的機率。

Workflow 目前使用：

```yaml
uses: actions/checkout@v6
```

用來 checkout `price-data` branch 並更新共享價格歷史。

### 手動測試

GitHub repository：

**Actions → Price Check + LINE Broadcast → Run workflow**

可立即執行一次完整流程：

```text
查價 → 保存歷史 → LINE Broadcast
```

---

## 💬 LINE Broadcast 設定

本專案使用 LINE Messaging API 的 Broadcast 功能。

請在 GitHub repository 設定 Secret：

**Settings → Secrets and variables → Actions → New repository secret**

名稱：

```text
LINE_CHANNEL_ACCESS_TOKEN
```

值填入 LINE Developers / Messaging API Channel 的 Channel Access Token。

> Token 不要直接寫入 repository。Workflow 會透過 `${{ secrets.LINE_CHANNEL_ACCESS_TOKEN }}` 讀取。

### 一般通知

每天兩次自動查價後，都會收到類似：

```text
🔎 商品價格自動檢查
滿意寶寶 純水99濕巾｜補充包 24包組

目前價格：NT$999
原價：NT$2,028
較上次：價格不變
庫存：❌ 無庫存
檢查時間：2026-08-10 16:13
```

### 🔥 低價警報

目前門檻設定：

```text
LOW_PRICE_THRESHOLD = 999
```

判斷條件是 **小於 999**，不是小於等於：

```text
NT$999 → 一般通知
NT$998 → 一般通知 + 🔥低價警報
NT$899 → 一般通知 + 🔥低價警報
```

低價時會在同一次 Broadcast 中額外送出第二則醒目訊息。

---

## 📈 價格歷史資料

GitHub Actions 的自動查價紀錄不存放在 `master`，而是使用獨立的：

```text
price-data
```

branch。

資料檔：

```text
price-history.json
```

格式：

```json
{
  "history": [
    {
      "date": "2026-08-10T06:11:33.692Z",
      "price": 999,
      "original_price": 2028,
      "in_stock": false
    }
  ]
}
```

最多保留最近 **180 筆**。

這樣每天更新價格資料時不需要修改 `master`，也不會因為單純新增價格紀錄而持續觸發 Vercel production deployment。

網頁啟動時 `src/main.jsx` 會讀取共享紀錄，再與目前瀏覽器內的手動查價紀錄合併。

---

## 🖥️ 網頁手動查價

網頁也可以直接按：

```text
🔍 立即查詢價格
```

手動查詢會更新目前瀏覽器的 `localStorage`。

網頁內原本的「每日自動查詢」開關仍可使用：開啟頁面時，如果該瀏覽器當天尚未查詢，就會自動查一次。

但真正不依賴瀏覽器的固定排程是由 **GitHub Actions** 負責。

---

## 🔧 本機開發

安裝依賴：

```bash
npm install
```

只啟動 Vite 前端：

```bash
npm run dev
```

因為 `/api/price` 是 Vercel Serverless Function，如果要在本機完整測試 API，建議使用 Vercel CLI：

```bash
npm i -g vercel
vercel dev
```

---

## 📁 主要檔案

```text
price-tracker/
├── .github/
│   └── workflows/
│       └── price-check-line.yml   # 定時查價、保存歷史、LINE 通知
├── api/
│   └── price.js                   # Vercel Serverless Function / PChome 查價
├── src/
│   ├── App.jsx                    # React 查價介面與價格走勢
│   └── main.jsx                   # 載入共享歷史並啟動 React
├── index.html
├── package.json
├── vite.config.js
└── README.md

price-data branch
└── price-history.json             # GitHub Actions 自動查價共享歷史
```

---

## 🔐 安全性

- `LINE_CHANNEL_ACCESS_TOKEN` 僅存放於 GitHub Actions Secrets。
- 不要將 Channel Access Token commit 到 GitHub。
- Workflow 執行 log 中 GitHub 會遮蔽 Secret。
- `price-history.json` 只包含價格、時間與庫存資訊，不包含 LINE Token。

---

## ❓常見問題

### 為什麼需要 Vercel Function？

瀏覽器直接跨網域呼叫 PChome API 可能受到 CORS 限制。`api/price.js` 在伺服器端查詢，可以避免瀏覽器 CORS 問題，並提供商品頁 HTML 備援解析。

### 關掉電腦還會自動查價嗎？

會。排程由 GitHub Actions 執行，不需要電腦、瀏覽器或網頁保持開啟。

### 為什麼使用 `price-data` branch？

避免每次自動查價都修改 `master`。價格資料與程式碼分離，也能避免因更新歷史資料而反覆部署 Vercel。

### NT$999 會發低價警報嗎？

不會。目前條件是 `price < 999`，所以最低要 NT$998 才會觸發低價警報。

### LINE Broadcast 會傳給誰？

會廣播給符合 LINE Messaging API Broadcast 發送條件的 Official Account 好友。目前這個專案採用 Broadcast，沒有綁定特定 user ID。
