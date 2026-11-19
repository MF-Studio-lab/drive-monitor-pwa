# 駕駛監控儀表板 (Drive Monitor PWA)

手機感測器即時監控駕駛行為：加速度 G-force、震動頻譜、速度曲線、天氣、路況。支援離線使用、本地資料儲存、CSV/JSON 匯出。

## 功能特色

- **即時感測器資料**：DeviceMotion API 讀取加速度計、陀螺儀、重力感測
- **GPS 追蹤**：速度、位置、海拔、行進方向
- **即時圖表**：
  - 三軸加速度向量 (m/s²)
  - 橫向/縱向/垂直 G-force 歷程
  - 震動合成頻譜
  - 速度曲線
- **舒適度指數**：基於 G-force 變化率計算駕駛平順度
- **環境資訊**：Open-Meteo 即時天氣 + TDX 即時路況
- **行程記錄**：IndexedDB 本地儲存，支援匯出 JSON/CSV
- **PWA 支援**：可安裝到主畫面、離線快取、Service Worker
- **感測器校準**：啟動時自動校準重力偏移

## 快速開始

### 本地開發

```bash
# 使用任意靜態伺服器 (需 HTTPS 才能使用感測器 API)
npx serve . -p 3000 --ssl-cert localhost.pem --ssl-key localhost-key.pem

# 或使用 Python
python3 -m http.server 3000
# 然後用 ngrok 或 cloudflared 建立 HTTPS tunnel
```

> **注意**：瀏覽器要求 **HTTPS** (或 localhost) 才允許存取 DeviceMotion/Geolocation API。

### 部署到 GitHub Pages

1. Fork 或建立新 repository
2. 將專案推到 `main` 分支
3. 在 GitHub 專案 Settings → Pages：
   - Source: "GitHub Actions"
4. 將 `.github/workflows/deploy.yml` 加入專案 (見下方)
5. Push 觸發自動部署

### TDX 路況 API 設定 (可選)

1. 申請 [TDX 開放平台](https://tdx.transportdata.tw/) 帳號並建立應用程式
2. 取得 `Client ID` 與 `Client Secret`
3. 在 `api.js` 中設定：

```javascript
// 在 app.js init() 中加入
api.setTDXCredentials('YOUR_CLIENT_ID', 'YOUR_CLIENT_SECRET');
```

或建立 `config.js` 載入環境變數。

## 專案結構

```
drive-monitor-pwa/
├── index.html          # 主頁面
├── manifest.json       # PWA Manifest
├── sw.js              # Service Worker
├── styles.css         # 樣式
├── app.js             # 主控制器
├── charts.js          # uPlot 圖表管理
├── sensors.js         # 感測器管理
├── storage.js         # IndexedDB 儲存
├── api.js             # 外部 API (天氣/路況)
├── icon.svg           # 圖示來源
├── icon-192.png       # PWA 圖示
├── icon-512.png
└── .github/workflows/deploy.yml  # GitHub Pages 部署
```

## 使用說明

1. **首次開啟**：點擊「授權並開始」允許感測器與 GPS 權限
2. **校準**：手機固定於車內手機架，**平放靜止** 3 秒完成重力校準
3. **開始記錄**：點擊「開始記錄」開始儲存行程資料
4. **駕駛中**：觀察即時 G-force、震動、速度、舒適度指數
5. **結束**：點擊「停止記錄」自動儲存並計算統計
6. **歷史行程**：底部列表可查看、匯出、刪除

## 圖表說明

| 圖表 | 說明 | 單位 |
|------|------|------|
| 加速度向量 | X=前後、Y=左右、Z=上下 (含重力) | m/s² |
| G-force 歷程 | 橫向/縱向/垂直 G 力 (扣除重力) | G |
| 震動頻譜 | 三軸合成震動幅度 | m/s² |
| 速度歷程 | GPS 瞬間速度 | km/h |

## 舒適度指數計算

```
基礎分 100 - (橫向G×15 + 縱向G×10 + 垂直偏移G×5)
≥80: 平穩  |  60-79: 略顯顛簸  |  40-59: 顛簸  |  <40: 劇烈顛簸
```

## 瀏覽器支援

| 功能 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| DeviceMotion | ✅ | ✅ (需授權) | ✅ | ✅ |
| DeviceOrientation | ✅ | ✅ | ✅ | ✅ |
| Geolocation | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| PWA 安裝 | ✅ | ✅ | ⚠️ | ✅ |

## 授權

MIT License

## 致謝

- [uPlot](https://github.com/leeoniya/uPlot) - 高效能圖表庫
- [Open-Meteo](https://open-meteo.com/) - 免費天氣 API
- [TDX](https://tdx.transportdata.tw/) - 台灣交通部開放平台
- [OpenStreetMap Nominatim](https://nominatim.org/) - 逆地理編碼