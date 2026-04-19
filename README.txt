彩券歷史統計工具 — 使用說明
=============================

檔案結構
--------
  index.html      主頁面
  style.css       樣式（手機優先 RWD）
  app.js          前端邏輯（載入資料、Chart.js、組合產生器）
  data.json       歷史開獎資料（目前為範例資料，待爬蟲首次執行後覆寫）
  scraper.py      Python 爬蟲，從台彩官網 API 抓取
  run_scraper.bat Windows 工作排程器呼叫用
  scraper.log     爬蟲執行紀錄（首次執行後自動產生）

啟動步驟
--------
1. 首次執行爬蟲（全量抓 2014 起歷史）：
       python scraper.py --full

   之後定期更新（只抓近兩個月）：
       python scraper.py

2. 開啟網頁：

   【建議】用本機伺服器啟動（避免 fetch data.json 被瀏覽器擋）：
       python -m http.server 8000
   然後瀏覽器開 http://localhost:8000

   直接雙擊 index.html 在部分瀏覽器會因 CORS 擋掉 fetch，
   Chrome/Edge 可能需要加 --allow-file-access-from-files 才行。

Windows 工作排程器設定
----------------------
1. 開啟「工作排程器」→「建立基本工作」
2. 名稱：更新彩券資料
3. 觸發程序：每週，勾選 週二、週三、週五、週六
   （大樂透週二週五開獎、威力彩週一週四開獎，隔天抓最穩）
4. 動作：啟動程式
   程式：D:\lottery-stats\run_scraper.bat
   開始位置：D:\lottery-stats
5. 完成

免責聲明
--------
本站僅為開獎歷史數據統計工具，資料來源於台灣彩券公開資訊，
僅供學習與娛樂用途。

聯絡方式
--------
LINE: AIRORTON
