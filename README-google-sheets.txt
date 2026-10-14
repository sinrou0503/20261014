Google 試算表線上題庫｜英文 p5.js 測驗使用說明
====================================================

本專案會直接讀取「公開發布」的 Google 試算表 CSV。老師修改試算表後，重新整理測驗網站，就會使用更新後的題目；不需要再修改或上傳本地 questions.csv。

檔案
----
- index.html：網頁入口，載入 Google Fonts、p5.js CDN 與 sketch.js。
- sketch.js：測驗程式與 Google 試算表 CSV 設定。
- README-google-sheets.txt：本說明文件。

一、建立 Google 試算表
----------------------
1. 建立一份新的 Google 試算表。
2. 第一列必須輸入以下固定欄位名稱，拼寫與大小寫請完全一致：

   id,question,optionA,optionB,optionC,optionD,answer

3. 從第二列開始，每一列填入一題。例如：

   id | question              | optionA | optionB | optionC | optionD | answer
   1  | What color is the sky? | Blue    | Red     | Green   | Black   | A

   answer 只能填 A、B、C 或 D，分別代表正確選項 optionA、optionB、optionC、optionD。
   題目必須有四個非空白選項；本程式會驗證欄位與每一列資料。

二、發布 Google 試算表到網路
----------------------------
1. 在 Google 試算表選「檔案 → 共用 → 發布到網路」。
2. 選擇要發布的工作表（不要誤選整份試算表，除非你確定內容相同）。
3. 格式選「CSV」。
4. 按「發布」，並確認發布提示。
5. 複製發布後的 URL。常見的 CSV URL 形式如下：

   https://docs.google.com/spreadsheets/d/試算表ID/export?format=csv&gid=工作表ID

   請以 Google 試算表實際產生的發布網址為準。

三、貼到 sketch.js 的設定區
---------------------------
1. 用文字編輯器開啟 sketch.js。
2. 找到檔案最前面的設定常數：

   const GOOGLE_SHEET_CSV_URL = "請將你的 Google 試算表 CSV 網址貼在這裡";

3. 將引號內的文字替換成剛才複製的發布後 CSV URL，例如：

   const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/你的ID/export?format=csv&gid=0";

4. 保留網址外面的雙引號，不要在網址後面多加逗號或其他文字。
5. 將 index.html、sketch.js 放在同一個資料夾後開啟 index.html。
   若瀏覽器限制直接開啟 file:// 的網路讀取，可用簡單的本機伺服器提供此資料夾。

四、更新題庫
------------
老師修改已發布的 Google 試算表後，重新整理網站即可讀取更新後的題目。
本版本至少支援「重新整理」更新；若未來需要自動更新，也可以在程式中加入每隔指定秒數重新載入 CSV 的功能。

五、重要注意事項
----------------
- Google 試算表必須公開發布，使用者瀏覽器才能讀取；私人試算表或需要登入的網址通常無法載入。
- 請確認複製的是 CSV 發布網址，不是只能開啟編輯介面的網址。
- 不要在 CSV 中使用未處理的逗號。若題目或選項需要逗號，請依 CSV 規則用雙引號包住完整欄位，或改用不含逗號的文字。
- 欄位名稱固定為 id、question、optionA、optionB、optionC、optionD、answer。
- 題庫至少要有 5 題有效資料，網站每次會洗牌後抽出 5 題；按「重新開始」會再次洗牌與抽題。
- 若網址尚未替換、發布失敗、欄位不符或題目資料錯誤，頁面會透過錯誤面板顯示原因，不會只留白。

測驗功能
--------
- 響應式 canvas，畫布大小等於視窗大小，並支援視窗調整。
- 桌面內容最大寬度 760px；手機使用單欄選項配置。
- 題目使用 Noto Serif TC 粗體，其他介面文字使用 Noto Sans TC。
- 作答後顯示正確答案為綠色、選錯答案為紅色，並提供下一題、總分與重新開始。
