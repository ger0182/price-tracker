# 🛒 滿意寶寶 PChome 價格追蹤器 v2

**完全免費，不需要任何 API Key！**

直接呼叫 PChome 公開商品 API 取得價格，透過 Vercel Serverless Function 作為代理避免 CORS 問題。

---

## 🚀 部署步驟（約 5 分鐘）

### 第一步：上傳到 GitHub

1. 前往 https://github.com，登入後點「**+ → New repository**」
2. Repository name 填 `price-tracker`，選 **Public**，點「**Create repository**」
3. 在你的電腦開啟終端機，執行：

```bash
# 進入專案資料夾（price-tracker-v2 解壓縮後的位置）
cd price-tracker-v2

git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的帳號/price-tracker.git
git push -u origin main
```

> 如果不熟悉 Git，也可以直接在 GitHub 網頁上點「uploading an existing file」逐一上傳檔案。

---

### 第二步：部署到 Vercel（免費）

1. 前往 https://vercel.com，點「**Sign up**」用 GitHub 帳號登入
2. 點「**Add New → Project**」
3. 找到你的 `price-tracker` repository，點「**Import**」
4. 其他設定保持預設，直接點「**Deploy**」

⚠️ **這次不需要填任何環境變數！**

5. 等待約 1 分鐘部署完成，Vercel 會給你一個網址：
   `https://price-tracker-xxxxx.vercel.app`

**把這個網址加入瀏覽器書籤！** ✅

---

## 📅 每日自動查詢

開啟網頁後，打開頁面內「**每日自動查詢**」開關：
- 每次開啟書籤頁面，若今天尚未查詢，會自動執行

想要完全不用手動開啟？使用 **UptimeRobot**（免費）：
1. 前往 https://uptimerobot.com 註冊
2. 點「**Add New Monitor**」
3. Monitor Type 選「**HTTP(s)**」
4. URL 填入你的 Vercel 網址
5. Monitoring Interval 選「**Every 1 day**」
6. 這樣每天會自動 ping 你的頁面，觸發自動查詢

---

## 🔧 本機測試

```bash
npm install
npm run dev
```

> 注意：本機開發時 `/api/price` 需要 Vercel CLI 才能運作。
> 安裝方式：`npm i -g vercel`，然後執行 `vercel dev` 而非 `npm run dev`

---

## 📁 檔案結構

```
price-tracker-v2/
├── api/
│   └── price.js        ← Vercel Serverless Function（爬蟲核心）
├── src/
│   ├── App.jsx         ← React 前端介面
│   └── main.jsx        ← 進入點
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## ❓ 常見問題

**Q: 為什麼需要 Vercel Function 而不是直接在瀏覽器呼叫 PChome API？**
A: 瀏覽器直接呼叫跨網域 API 會被 CORS 政策阻擋。Vercel Function 在伺服器端呼叫，不受此限制。

**Q: 價格記錄存在哪裡？**
A: 存在你瀏覽器的 localStorage，換裝置或清除瀏覽器資料會遺失。

**Q: 每月費用？**
A: 完全免費。Vercel 免費方案每月 100GB 流量，每天一次查詢完全夠用。
