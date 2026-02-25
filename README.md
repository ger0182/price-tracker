# 🛒 滿意寶寶 PChome 價格追蹤器

每日自動追蹤 PChome 24h「滿意寶寶 純水99嬰兒濕巾補充包(24包組)」的售價。

---

## 🚀 部署步驟（總共約 10 分鐘）

### 第一步：上傳到 GitHub

1. 前往 https://github.com，登入或註冊帳號
2. 點右上角「**+**」→「**New repository**」
3. Repository name 填：`price-tracker`
4. 選擇 **Public**，點「**Create repository**」
5. 依照 GitHub 頁面顯示的指令，將這個資料夾推上去：

```bash
cd price-tracker
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的帳號/price-tracker.git
git push -u origin main
```

---

### 第二步：取得 Anthropic API Key

1. 前往 https://console.anthropic.com/
2. 登入 → 點左側「**API Keys**」→「**Create Key**」
3. 複製 `sk-ant-api03-...` 開頭的金鑰（只顯示一次，請妥善保存）

---

### 第三步：部署到 Vercel（免費）

1. 前往 https://vercel.com，用 GitHub 帳號登入
2. 點「**Add New → Project**」
3. 選擇你的 `price-tracker` repository → 點「**Import**」
4. 展開「**Environment Variables**」，新增：
   - **Name**：`VITE_ANTHROPIC_API_KEY`
   - **Value**：貼上你的 API Key
5. 點「**Deploy**」

部署完成後，Vercel 會給你一個網址，例如：
`https://price-tracker-xxx.vercel.app`

**這個網址就可以加入書籤了！** ✅

---

## 📅 設定每日自動查詢

部署完成後，有兩種方式讓它每天自動執行：

### 方式 A：手動開啟（簡單）
在網頁內開啟「每日自動查詢」開關，每天打開書籤頁面即自動記錄。

### 方式 B：全自動（進階）
使用 [UptimeRobot](https://uptimerobot.com)（免費）每天定時 ping 你的 Vercel 網址，
搭配頁面內的自動查詢功能，即可完全無人工介入每日記錄。

---

## 🔧 本機開發

```bash
# 安裝依賴
npm install

# 複製環境變數範本
cp .env.example .env.local
# 編輯 .env.local，填入你的 API Key

# 啟動開發伺服器
npm run dev
```

---

## 💡 注意事項

- 歷史價格記錄儲存在**瀏覽器 localStorage**，換裝置不會同步
- Anthropic API 每次查詢約消耗極少 token（成本 < $0.01 TWD）
- API Key 請勿分享或公開到 GitHub（已加入 .gitignore）
