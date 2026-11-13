# 娃娃機台主營運管理系統 (ClawOps Pro) 升級版規格計畫書

本規劃書整合傳統「類比台（機械滾輪錶防呆）」、主流「數位台（如飛洛莉，電子查帳/純實收記帳）」以及高毛利「刮刮樂（戳戳樂）盤面管理與號碼獲利統計」，並依據台主實務需求將爪口底貨完全剔除，專注於精確核算大獎成本與各板淨利。

---

## 1. 系統核心架構與機台模式定義

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ClawOps Pro 複合營運管理系統                          │
├───────────────────┬───────────────────┬────────────────────────────────┤
│   1. 類比機台模組  │   2. 數位機台模組  │     3. 刮刮樂 (戳戳樂) 模組    │
│  (機械計數器/OCR) │  (飛洛莉/純記帳)  │  (號碼矩陣/整板結算/號碼榜)    │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ 4. 獎品庫存中心 (大獎/次獎) │ 5. 耗材與場租攤提 │ 6. 全場綜合財務報表  │
└───────────────────────────────────────┴────────────────────────────────┘
```

### 機台類型 (Machine Types) 運作切換
1. **類比機台 (Analog Machine)**：
   - 適用傳統台子，需記錄 6 位數實體機械滾輪「投幣錶」與「出貨錶」。
   - 具備溢位翻轉（$999,999 \to 0$）與換錶防呆校驗，支援 AI 拍照辨識。
2. **數位機台 (Digital Machine - 如飛洛莉、斑馬等)**：
   - 主機板已內建電子液晶顯示與清除功能。
   - **極簡化流程**：台主巡場只需輸入「本次清幣實收金額」或「電子總錶 Total In」，免除繁瑣微動出貨錶校正與防呆阻擋。
3. **刮刮樂附掛模式 (Scratch Card Mode)**：
   - 任何類比台或數位台皆可「綁定刮刮樂板」。
   - 機台運作從以「單次抄錶」為核心，切換為以「整塊刮板 (Board Session)」為生命週期。

---

## 2. 刮刮樂（戳戳樂）專屬模組規格

### 2.1 洞數規格與自訂
* **常用預設洞數**：提供一鍵快選按鈕：`20`、`40`、`60`、`80`、`100`、`120`、`160`、`200`、`240`、`300` 洞。
* **自訂洞數**：支援任意整數輸入（例如 50 洞、150 洞）。

### 2.2 成本模型（徹底剔除爪口底貨）
* **不計算爪口雜物**：機台內夾取的小物、吊飾、娃娃不列入計算，不扣庫存，不計成本。
* **整版總成本計算公式**：
  $$\text{該板總成本} = \text{空白刮板進價成本} + \sum (\text{已被刮出並兌換之大獎實際成本})$$
* **未中獎之剩餘獎品**：整版下版或大獎出清時，機台上未被刮出的其餘獎品直接退回庫存，**絕不計入該板成本**。

### 2.3 刮板完整生命週期 (Board Lifecycle)
1. **上版建立 (New Board Session)**：
   - 選擇洞數與設定該張刮板進價（如 $50 元）。
   - 設定獎項號碼對應表：
     - *範例*：`01 號` $\to$ 海賊王四檔魯夫（進價 $650）；`02 號` $\to$ 藍牙音響（進價 $280）；`37 號` $\to$ 巨無霸大熊（進價 $500）。
   - 記錄起始錨點：登記上版當下的「起始幣量 (Coin In Start)」或歸零起算。
2. **運行中與兌獎核銷 (In-Progress & Claiming)**：
   - 提供「可視化號碼矩陣圖 (Visual Grid)」：
     - 台主可隨時在手機上點擊已刮出號碼（例如點擊 `37` 變更為「已開出/已兌換」）。
     - 同步支援巡場時一次勾選多個中獎號碼。
3. **下版結算 (Close Board Session)**：
   - 觸發時機：大獎已被開出提早下版，或客人包板全開。
   - 登記結束錨點：記錄下版時的「結束幣量 (Coin In End)」或該板「總收幣金額」。
   - **財務核算**：
     $$\text{整版營收} = \text{總投幣額} \times 10$$
     $$\text{整版淨利} = \text{整版營收} - (\text{刮板成本} + \text{已開出大獎總成本})$$
     $$\text{該板毛利率} = \frac{\text{整版淨利}}{\text{整版營收}} \times 100\%$$

---

## 3. 樂趣功能：號碼獲利排行榜 (Number ROI & Luck Matrix)

為滿足台主了解「哪些號碼帶財、哪些號碼秒殺賠錢」的營運樂趣，系統依據各板終局盈虧建立歷史號碼分析庫。

### 3.1 指標定義
* **獲利貢獻值 (Net Profit Contribution)**：
  每個中獎號碼開出時，繼承該板的最終淨利：
  $$\text{號碼累積貢獻} = \sum (\text{該號碼開出板的整板淨利})$$
* **吸金深度比 (Coin Depth Ratio)**：
  統計該號碼開出時，平均讓客人投了多少幣：
  $$\text{平均吸金幣量} = \frac{\text{該號碼中獎各板之總營收累計}}{\text{該號碼中獎次數}}$$

### 3.2 榜單視圖 (Leaderboard Views)
1. **招財神號榜 (Gold Numbers)**：
   - 經常撐到最後幾抽才被開出、每次出現都帶來高額淨利的號碼（例如：`37 號` 平均投幣 $3,200 才開出，累積帶進獲利 $+12,400$ 元）。
2. **地雷早洩榜 (Bleeding Numbers)**：
   - 常常在前段（例如幾百元內）就被客人秒殺帶走大獎的號碼，提示台主未來編號時調整位置或更換數字。
3. **冷熱門號碼熱點分佈 (Heatmap)**：
   - 以九宮格或數字分佈圖呈現 $1 \sim 100$ 號的大獎中獎率分佈。

---

## 4. 資料庫實體設計 (Database Schema)

```sql
-- 1. 機台資料表 (支援類比與數位)
CREATE TABLE machines (
    machine_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                  -- 機台名稱 (例如: A01 飛洛莉數位台 / B02 類比公仔台)
    machine_model TEXT NOT NULL,         -- 'ANALOG' (類比台) 或 'DIGITAL' (數位台)
    location TEXT NOT NULL,
    rent_monthly REAL DEFAULT 0,         -- 月租金
    electricity_fee REAL DEFAULT 0,      -- 月電費
    coin_unit_value REAL DEFAULT 10,
    is_active INTEGER DEFAULT 1
);

-- 2. 刮刮樂板面管理表
CREATE TABLE scratch_boards (
    board_id TEXT PRIMARY KEY,
    machine_id TEXT REFERENCES machines(machine_id),
    title TEXT NOT NULL,                 -- 板名 (例如: 第 12 期 金證海賊王 100 洞)
    total_holes INTEGER NOT NULL,        -- 總洞數 (20, 40, ..., 300, 或自訂)
    board_cost REAL DEFAULT 0,           -- 空白刮板單價成本
    status TEXT NOT NULL,                -- 'PREPARING', 'ACTIVE', 'SETTLED'
    start_coin_reading INTEGER,          -- 上版時投幣讀數 (若適用)
    end_coin_reading INTEGER,            -- 下版時投幣讀數 (若適用)
    total_revenue REAL DEFAULT 0,        -- 整版總營業額 (現金)
    total_prize_cost REAL DEFAULT 0,     -- 已兌換大獎總成本
    net_profit REAL DEFAULT 0,           -- 該板真實淨利
    created_at TIMESTAMP NOT NULL,
    settled_at TIMESTAMP
);

-- 3. 刮板獎項號碼映射與開出紀錄
CREATE TABLE scratch_board_prizes (
    item_id TEXT PRIMARY KEY,
    board_id TEXT REFERENCES scratch_boards(board_id),
    number_label INTEGER NOT NULL,       -- 對應號碼 (例如: 1, 2, 37)
    prize_name TEXT NOT NULL,            -- 獎品名稱 (例如: 四檔魯夫公仔)
    prize_cost REAL NOT NULL,            -- 進貨成本
    is_claimed INTEGER DEFAULT 0,        -- 0: 未開出, 1: 已開出兌換
    claimed_at TIMESTAMP,                -- 開出兌換時間
    is_returned_to_stock INTEGER DEFAULT 0 -- 下版時未開出是否退回倉庫庫存 (1: 是)
);

-- 4. 一般抄錶與純記帳紀錄表 (兼顧類比與數位)
CREATE TABLE audit_logs (
    log_id TEXT PRIMARY KEY,
    machine_id TEXT REFERENCES machines(machine_id),
    board_id TEXT REFERENCES scratch_boards(board_id), -- 可關聯當前刮板
    logged_at TIMESTAMP NOT NULL,
    -- 類比台欄位 (選填)
    analog_coin_counter INTEGER,
    analog_prize_counter INTEGER,
    reset_mode TEXT,                     -- 'NORMAL', 'OVERFLOW', 'REPLACED'
    -- 數位台/通用實收欄位
    cash_collected REAL NOT NULL,        -- 本次實收現金
    notes TEXT
);

-- 5. 高價值獎品主庫存表 (不含爪口底貨)
CREATE TABLE products (
    product_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,                       -- 盒裝公仔, 3C周邊, 盲盒, 巨無霸
    unit_cost REAL NOT NULL,
    stock_warehouse INTEGER DEFAULT 0    -- 倉庫現存未上機數量
);

-- 6. 耗材與固定成本支出
CREATE TABLE expenses (
    expense_id TEXT PRIMARY KEY,
    machine_id TEXT,                     -- NULL 代表全場合併
    category TEXT NOT NULL,              -- 'RENT', 'ELECTRICITY', 'CLAW_TIPS', 'TAPE', 'MISC'
    amount REAL NOT NULL,
    incurred_date DATE NOT NULL,
    note TEXT
);
```

---

## 5. 使用者介面與操作流程更新

### 5.1 巡場記帳切換視圖
* **數位台快速記帳**：
  進入機台後直接顯示簡潔大鍵盤，填入「本日清幣金額：$XXXX」，即時更新當月營收與固定租金扣減進度。
* **類比台抄錶**：
  維持擬真 6 位數滾輪與 AI 拍照辨識，具備防呆機制。

### 5.2 刮刮樂看板工作台 (Scratch Board Dashboard)
* **板面視覺矩陣**：
  網格呈現所有號碼（如 1~100）。已被刮中的號碼顯示灰色刪除線並標記領取者，未刮中的大獎號碼以高亮琥珀金標示。
* **一鍵下版結算**：
  點擊「結算下版」時，系統自動列出未被刮出的大獎，提示「確認將 2 號藍牙音響退回庫存？」，確認後自動計算該板毛利，並將中獎號碼加入「號碼獲利排行榜」。