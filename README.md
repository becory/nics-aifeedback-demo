# AI 回饋系統

純前端的 AI 回饋系統管理後台，資料儲存於瀏覽器 localStorage。

## 功能

- **登入驗證**：預設帳號 `admin` / `admin`，首次登入需綁定二階段驗證（TOTP）
- **組織管理**：組織名稱、組織代碼（CRUD）
- **服務管理**：服務名稱、所屬組織、服務代碼（CRUD）
- **使用者管理**：中文名稱、信箱、密碼、二階段驗證、所屬組織（多選）、管理員權限（CRUD）

## 開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

## 技術棧

- React + TypeScript + Vite
- Tailwind CSS
- React Router
- otplib（TOTP 二階段驗證）

## 注意事項

- 此為純前端示範專案，密碼與資料僅存於瀏覽器本地，不適用於正式環境
- 清除瀏覽器資料會重置所有內容並還原預設 admin 帳號
