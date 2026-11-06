export type MachineModel = 'DIGITAL' | 'ANALOG';

export type CounterResetMode = 'NORMAL' | 'OVERFLOW' | 'REPLACED';

// 數位/類比機台記錄動作：分段清0、下版清0、或純查看不歸零
export type ClearActionType = 'SEGMENT_CLEAR' | 'BOARD_CLOSE_CLEAR' | 'SNAPSHOT_ONLY';

// 獎品獲取方式：採購、全新、二手、打台(打別人的台子夾出)
export type AcquisitionSource = '採購' | '全新' | '二手' | '打台';

// 貨物目前所在位置：倉庫庫存中 vs 已上機台當獎品
export type ItemPlacement = 'IN_STOCK' | 'ON_MACHINE';

export type ScratchBoardStatus = 'ACTIVE' | 'SETTLED';

// 1. 自訂動態固定費用項目 (例如: 公家電費、網路監視器、冷氣費、折舊)
export interface MachineCustomFee {
  fee_id: string;
  title: string;
  amount: number;
  note?: string;
}

// 定期付款紀錄 (台租、電費等各期繳納歷史)
export interface MachinePaymentRecord {
  payment_id: string;
  machine_id: string;
  title: string;
  amount: number;
  due_date?: string;
  paid_at: string;
  period_label: string; // 例如 "2026-11"
  status: 'PAID' | 'PENDING';
  note?: string;
}

// 機台資料表 (支援二手底數初始化、多項自訂費用、定期付款)
export interface Machine {
  machine_id: string;
  code: string;                  // 例如: A01, A02, B01
  name: string;                  // 機台名稱
  machine_model: MachineModel;   // 'DIGITAL' (數位面板) | 'ANALOG' (傳統滾輪錶)
  location: string;              // 場地名稱
  rent_monthly: number;          // 台租費用 (基礎月租)
  other_fixed_fee: number;       // 保留相容舊欄位
  other_fee_note?: string;       // 保留相容舊欄位
  custom_fixed_fees?: MachineCustomFee[]; // 多筆自由新增的固定開銷項目
  rent_pay_day?: number;         // 每月應繳租金日 (1~31)
  payment_records?: MachinePaymentRecord[]; // 定期費用繳納紀錄
  initial_coin_counter?: number; // 二手機台初始投幣錶底數 (計算基準點)
  initial_prize_counter?: number;// 二手機台初始出貨錶底數 (計算基準點)
  coin_unit_value: number;       // 單幣面額 (預設 10 元)
  last_coin_counter: number;     // 類比幣錶讀數 或 數位面板累計參考值
  last_prize_counter: number;    // 類比出貨錶讀數
  active_board_id?: string | null; // 當前主要刮板 (保留相容)
  last_read_at: string;
  is_active: boolean;
}

// 2. 刮板獎項設定 (號碼必填；名稱、金額選填；若勾選「回錢」則金額必填，中獎時自動從本版幣量營收扣除)
export interface ScratchBoardPrize {
  item_id: string;
  board_id: string;
  number_label: number;          // 獎項號碼 (必填)
  prize_name?: string;           // 獎項名稱 (選填，例如: 四檔魯夫、大獎、或純回錢)
  is_cashback: boolean;          // 是否為「回錢 / 退幣」獎項
  cashback_amount: number;       // 回錢金額 (勾選回錢時必填，中獎時直接從本版總收幣營收扣除)
  prize_cost: number;            // 獎品本身進貨成本 (選填，給實體商品算毛利)
  inventory_item_id?: string;    // 若綁定大獎庫存項目 ID
  is_claimed: boolean;           // 是否已開出中獎
  claimed_at?: string;
}

// 刮板分批巡場進度紀錄 (每次記錄剩幾洞、哪些獎號出了)
export interface BoardCheckLog {
  check_id: string;
  logged_at: string;
  remaining_holes: number;       // 當下剩餘幾個洞
  newly_claimed_numbers: number[]; // 本次新開出的獎項號碼
  recorded_cash_added: number;   // 本次同步記錄的收幣金額
  note?: string;
}

// 3. 刮刮樂板面管理表
export interface ScratchBoard {
  board_id: string;
  machine_id: string;
  board_letter?: string;         // 機台專屬英文字母標記 (如 'A', 'B', 'C'...)
  board_seq?: number;            // 機台專屬版次順序 (1=A, 2=B...)
  title: string;                 // 板名 (選填或自動產生，例如: A01 1號版 - 80刮)
  total_holes: number;           // 總刮數/總洞數 (如 40, 60, 80, 100, 120, 160, 200)
  remaining_holes: number;       // 當前剩餘幾個洞
  board_cost: number;            // 刮板本身紙本成本 (選填，預設 0 或 50)
  status: ScratchBoardStatus;    // 'ACTIVE' (板在台上) | 'SETTLED' (已下版結算)
  gross_coin_revenue: number;    // 面板累計總收幣金額 (未扣回錢前)
  total_cashback_deducted: number; // 已開出之「回錢」獎項總扣減金額
  net_coin_revenue: number;      // 扣除回錢後之實質收幣營收 = gross_coin_revenue - total_cashback_deducted
  total_prize_cost: number;      // 已開出之實體獎品成本合計
  net_profit: number;            // 本版最終賺賠 = net_coin_revenue - total_prize_cost - board_cost
  prizes: ScratchBoardPrize[];   // 獎項清單 (可於上版後隨時貼入/修改)
  check_logs: BoardCheckLog[];   // 分批巡場剩餘洞數紀錄
  created_at: string;
  settled_at?: string;
  notes?: string;
}

// 4. 機台收幣與清0紀錄表 (對應數位面板清0 / 下版清0 / 類比抄錶)
export interface MeterReading {
  reading_id: string;
  machine_id: string;
  board_id?: string | null;
  entry_mode: MachineModel;
  clear_action: ClearActionType; // 'SEGMENT_CLEAR' (分段紀錄後清0) | 'BOARD_CLOSE_CLEAR' (下版清0) | 'SNAPSHOT_ONLY' (僅記錄未清0)
  read_at: string;
  panel_amount: number;          // 數位面板看到的金額 或 類比換算金額
  cash_collected: number;        // 本次入帳金額
  last_coin_counter: number;
  coin_counter: number;
  last_prize_counter: number;
  prize_counter: number;
  reset_mode: CounterResetMode;
  coins_delta: number;
  prizes_delta: number;
  notes: string;
}

// 5. 大獎與貨物庫存表 (支援「機台上當獎品 ON_MACHINE」與「倉庫庫存 IN_STOCK」隨時切換)
export interface InventoryItem {
  item_id: string;
  name: string;                  // 貨物/獎品名稱
  category: string;              // 類別 (可自由新增，如 公仔、3C、娃娃、盲盒...)
  acquisition_source: AcquisitionSource; // 獲取方式：'採購' | '全新' | '二手' | '打台'
  unit_cost: number;             // 取得成本 (若是打台即為打台花費)
  quantity: number;              // 數量
  placement: ItemPlacement;      // 'ON_MACHINE' (當前在機台上當獎品) | 'IN_STOCK' (倉庫未上機)
  machine_id?: string | null;    // 若 placement === 'ON_MACHINE'，對應哪一台機台
  note?: string;
  updated_at: string;
}

// 6. 耗材與雜項費用 (選用功能，保留在場租與耗材頁)
export interface Expense {
  expense_id: string;
  machine_id: string | null;     // null 代表全場共用
  title: string;                 // 費用名稱 (例如：爪套、彈力繩、消光膠帶、或其他雜支)
  amount: number;
  is_advanced_amortized: boolean;// 是否啟用按日攤提 (選用)
  spread_days: number;
  incurred_date: string;
  note: string;
}

// 7. 樂趣功能：號碼統計指標 (選了幾次當獎號、幾版賺錢、幾版賠錢、累積盈虧)
export interface NumberLuckStat {
  number_label: number;
  times_selected: number;        // 被選為獎項號碼的總次數
  times_claimed: number;         // 被刮出中獎的次數
  win_boards_count: number;      // 該號碼所在板最終「賺錢」的板數
  loss_boards_count: number;     // 該號碼所在板最終「虧損」的板數
  win_rate_pct: number;          // 帶財勝率 %
  cumulative_board_profit: number; // 該號碼參與結算板之總淨利加總
  total_cashback_given: number;  // 該號碼累計回出去的錢
  last_prize_name: string;
}

export interface ReadingInput {
  currentCoinCounter: number;
  currentPrizeCounter: number;
  lastCoinCounter: number;
  lastPrizeCounter: number;
  resetMode: CounterResetMode;
}

export interface SessionMetricsResult {
  coinDelta: number;
  prizeDelta: number;
  revenue: number;
  costPerPrize: number;
  hasCounterDropWarning: boolean;
  coinDropped: boolean;
  prizeDropped: boolean;
}
