# 壽司接接樂 Prototype

這是一個可展示的餐廳等待區互動系統第一版 prototype。

## 專案內容
- `index.html`：入口頁與專案說明
- `wall.html`：大牆端畫面
- `mobile.html`：手機端畫面
- `style.css`：共用樣式
- `wall.js`：大牆端遊戲邏輯
- `mobile.js`：手機端互動邏輯

## 功能
### 大牆端
- 主遊戲區
- 排隊資訊區
- QR code 加入提示區
- 回合倒數與分數
- 主玩家可直接拖曳托盤左右移動
- 可模擬接住掉落壽司
- 接收手機端支援事件

### 手機端
- 加入首頁
- 已加入等待頁
- 支援操作頁
- 結果頁
- 可送出普通壽司、加分壽司、托盤放大支援、掉落減速支援

## 本地預覽方式
### 方式一：直接開啟
1. 解壓縮資料夾。
2. 直接雙擊 `index.html`。
3. 可先查看靜態畫面與基本連結。

### 方式二：建議示範方式
為了讓 `wall.html` 與 `mobile.html` 的同步效果更穩定，建議使用本地伺服器。

#### 如果你有 Python
在資料夾內開啟終端機並執行：

```bash
python -m http.server 5500
```

之後用瀏覽器開啟：
- `http://localhost:5500/index.html`
- `http://localhost:5500/wall.html`
- `http://localhost:5500/mobile.html`

#### 如果你用 VS Code
可安裝 Live Server，之後右鍵 `index.html` 選擇 **Open with Live Server**。

## 示範建議
1. 先開 `wall.html` 作為大牆端。
2. 再開 `mobile.html` 作為手機端。
3. 在手機端按「開始加入」。
4. 進入支援操作頁後，按下任一支援按鈕。
5. 大牆端會出現同步提示，並新增壽司或支援效果。

## 備註
- 本專案使用 mock data，未串接真實餐廳排隊系統。
- QR code 區域目前為視覺佔位，後續可替換成真實 QR code。
- 目前以課堂展示用 prototype 為主，不是正式商用版本。
