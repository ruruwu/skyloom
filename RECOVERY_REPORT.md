# LocalStorage 復原修改報告

## Root Cause

原流程只讀取 `creativeArcana.library.v3`。Creative Arcana 先整理混合資料時，Skyloom 內容已移至 `creativeArcana.recovery.original.v1`，舊共用 key 剩下 Arcana 內容，Skyloom 因而無法取得舊紀錄。

已檢查本機 `C:/plurk_extension/creative_arcana_v0.2/arcana-store.js`：備份直接保存原始 JSON 字串，沒有額外包裝。

## 修改檔案與流程

- `skyloom-store.js`：在既有初始化流程補上唯讀備份來源，重用 `cleanLibrary`；保護已存在的新版資料與空白收藏，寫入失敗時保留已讀取的資料供顯示並禁止修改。
- `tests/recovery.test.js`：新增模擬 LocalStorage 的復原、優先順序、唯讀來源及失敗重試測試；可帶入實際 Arcana 模組驗證開啟順序。
- `README.md`：更新讀取順序與錯誤處理說明。
- `RECOVERY_REPORT.md`：記錄修改及驗證結果。

新版 key 的有效資料優先，即使沒有遷移標記或收藏為空也不讀舊來源。新版 key 不存在才依序讀舊共用 key、原始備份；依過濾後的紀錄、收藏、牌組或明確 Skyloom 分類判斷是否可復原。只保留 c01–c17 且符合既有結構的內容，混合來源的單筆抽卡紀錄仍依原規則整筆排除。

來源不存在或格式有效但沒有 Skyloom 內容時可正常初始化；解析或讀取失敗時仍嘗試下一來源，若沒有成功復原則保留錯誤狀態並停止寫入。新版資料損壞時保留原文，不用備份覆寫。資料及完成標記同次寫入，寫入失敗不會持久化完成標記。

## 實際測試結果

皆使用記憶體 Map 模擬儲存，未操作真實瀏覽器 LocalStorage。

| 案例 | 結果 | 驗證內容 |
| --- | --- | --- |
| TC01 | PASS | Skyloom → 實際 Arcana 遷移模組，雙方資料保留 |
| TC02 | PASS | 實際 Arcana 遷移模組 → Skyloom，從其產生的原始備份復原 |
| TC03 | PASS | 新版有效紀錄優先，無遷移標記亦保留 |
| TC04 | PASS | 舊 key 僅有 Arcana 資料時繼續讀備份 |
| TC05 | PASS | 混合備份只恢復 Skyloom 收藏 |
| TC06 | PASS | 無 Skyloom 內容及不符格式不會匯入 |
| TC07 | PASS | 損壞 JSON 保留原文，既有新版資料優先 |
| TC08 | PASS | 反覆建立 store 不再讀取舊來源 |
| TC09 | PASS | 移除收藏後重開及既有空白新版資料均不復活收藏 |
| TC10 | PASS | 重新建立 store 後仍有復原資料 |

額外通過：舊 key JSON 損壞仍可從備份復原、寫入失敗禁止修改且可重試、新版寫入失敗保留原有紀錄。既有 migration 與 import-isolation 測試、JavaScript 語法檢查皆通過。

執行命令：

```powershell
node tests/recovery.test.js C:/plurk_extension/creative_arcana_v0.2/arcana-store.js
node tests/migration.test.js
node tests/import-isolation.test.js
node --check skyloom-store.js
```

## 殘餘風險與未驗證項目

- 真實瀏覽器 UI、跨分頁競爭及瀏覽器實際容量限制：NOT TESTED；寫入例外僅以模擬驗證。
- LocalStorage 必須在同一來源才能互讀；不同網域、連接埠或瀏覽器設定檔無法自動復原。
- 沿用既有一年歷史期限及資料辨識規則；過期歷史、不符結構或混合來源的單筆紀錄不會恢復。
- 新版有效但空白的資料優先，可避免收藏復活；無法推斷它是否由過去版本誤先初始化，這類情況仍需使用既有手動匯入。
- 開啟順序整合測試依賴本機 Arcana 模組路徑；未提供路徑時明確輸出 TC01、TC02 NOT TESTED。
