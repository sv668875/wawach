import {
  Expense,
  Machine,
  NumberLuckStat,
  ReadingInput,
  ScratchBoard,
  ScratchBoardPrize,
  SessionMetricsResult,
} from '../types';

export const OVERFLOW_LIMIT = 1_000_000;

/**
 * 將數字格式化為 6 位數類比滾輪字串 (例如 48291 -> "048291")
 */
export function formatSixDigit(val: number): string {
  const clamped = Math.max(0, Math.min(999999, Math.floor(Number(val) || 0)));
  return String(clamped).padStart(6, '0');
}

/**
 * 類比台抄錶核心計算邏輯
 */
export function calculateSessionMetrics(
  input: ReadingInput,
  coinRate = 10
): SessionMetricsResult {
  const coinDropped = input.currentCoinCounter < input.lastCoinCounter;
  const prizeDropped = input.currentPrizeCounter < input.lastPrizeCounter;
  const hasCounterDropWarning = coinDropped || prizeDropped;

  let coinDelta = 0;
  let prizeDelta = 0;

  if (input.resetMode === 'NORMAL') {
    coinDelta = input.currentCoinCounter - input.lastCoinCounter;
    prizeDelta = input.currentPrizeCounter - input.lastPrizeCounter;
  } else if (input.resetMode === 'OVERFLOW') {
    coinDelta = coinDropped
      ? OVERFLOW_LIMIT - input.lastCoinCounter + input.currentCoinCounter
      : input.currentCoinCounter - input.lastCoinCounter;
    prizeDelta = prizeDropped
      ? OVERFLOW_LIMIT - input.lastPrizeCounter + input.currentPrizeCounter
      : input.currentPrizeCounter - input.lastPrizeCounter;
  } else if (input.resetMode === 'REPLACED') {
    coinDelta = coinDropped
      ? input.currentCoinCounter
      : input.currentCoinCounter - input.lastCoinCounter;
    prizeDelta = prizeDropped
      ? input.currentPrizeCounter
      : input.currentPrizeCounter - input.lastPrizeCounter;
  }

  const safeCoinDelta = Math.max(0, coinDelta);
  const safePrizeDelta = Math.max(0, prizeDelta);
  const revenue = safeCoinDelta * coinRate;
  const costPerPrize = safePrizeDelta > 0 ? revenue / safePrizeDelta : 0;

  return {
    coinDelta: safeCoinDelta,
    prizeDelta: safePrizeDelta,
    revenue,
    costPerPrize: Number(costPerPrize.toFixed(1)),
    hasCounterDropWarning,
    coinDropped,
    prizeDropped,
  };
}

/**
 * 刮刮樂版面損益與「回錢自動扣減幣量」核心計算
 * - 當標註「回錢 (is_cashback)」的號碼中獎 (is_claimed) 時，自動將 cashback_amount 從當版總收幣金額 (grossCoinRevenue) 中扣掉！
 */
export function calculateScratchBoardFinancials(
  boardCost: number,
  grossCoinRevenue: number,
  prizes: ScratchBoardPrize[]
): {
  grossCoinRevenue: number;
  totalCashbackDeducted: number;
  netCoinRevenue: number;
  claimedPrizeCost: number;
  netProfit: number;
  claimedCount: number;
} {
  const claimedPrizes = (prizes || []).filter((p) => p && p.is_claimed);

  // 1. 回錢扣減計算：
  // 只有客人選擇「回錢」(claim_type === 'CASHBACK') 或純回錢獎項時，才計入回錢現金支出
  const totalCashbackDeducted = claimedPrizes.reduce((sum, p) => {
    if (p.claim_type === 'CASHBACK') {
      return sum + (Number(p.cashback_amount) || 0);
    }
    if (p.claim_type === 'PHYSICAL') {
      return sum; // 客人拿獎(實體商品)，台主無現金支出
    }
    // 相容未指定的情況：若有回錢金額且無實體成本，計入回錢
    if (p.is_cashback && (!p.prize_cost || p.prize_cost === 0)) {
      return sum + (Number(p.cashback_amount) || 0);
    }
    // 若同時有回錢與實體成本但未明確標註，擇一以回錢為優先扣除
    if (p.is_cashback) {
      return sum + (Number(p.cashback_amount) || 0);
    }
    return sum;
  }, 0);

  // 2. 實體獎品成本計算：
  // 只有客人選擇「拿獎」(claim_type === 'PHYSICAL') 或純實體獎項時，才計入獎品成本消耗
  // 若客人選擇「回錢」，實體獎品依然完好留存在機台/倉庫中，成本不損耗！
  const claimedPrizeCost = claimedPrizes.reduce((sum, p) => {
    if (p.claim_type === 'CASHBACK') {
      return sum; // 客人選擇折現回錢，實體獎品未消耗，不扣成本！
    }
    if (p.claim_type === 'PHYSICAL') {
      return sum + (Number(p.prize_cost) || 0);
    }
    // 相容舊資料：若未勾選回錢，才扣實體成本
    if (!p.is_cashback) {
      return sum + (Number(p.prize_cost) || 0);
    }
    // 若勾選了回錢且無標註 claim_type，上方已扣除現金，此處不重複扣除成本以避免重複雙重扣減！
    return sum;
  }, 0);

  // 實質幣量 (毛收幣扣除回錢現金支出後的實收幣量，可為負數代表倒賠)
  const netCoinRevenue = (Number(grossCoinRevenue) || 0) - totalCashbackDeducted;

  // 總淨利 = 毛收幣 - 回錢現金支出 - 實體獎品成本 - 空板成本
  // 無論客人選擇「拿獎」(失去商品成本) 還是「回錢」(給付現金)，對台主淨利損益影響完全對等！
  const netProfit =
    (Number(grossCoinRevenue) || 0) -
    totalCashbackDeducted -
    claimedPrizeCost -
    (Number(boardCost) || 0);

  return {
    grossCoinRevenue: Number(grossCoinRevenue) || 0,
    totalCashbackDeducted,
    netCoinRevenue,
    claimedPrizeCost,
    netProfit,
    claimedCount: claimedPrizes.length,
  };
}

/**
 * 自動產生下一個不重複的機台代號 (如 A01 -> A02, B01 -> B02)
 */
export function getNextMachineCode(machines: Machine[]): string {
  if (!machines || machines.length === 0) return 'A01';

  const regex = /^([A-Za-z]*)(\d+)$/;
  let maxPrefix = 'A';
  let maxNum = 0;
  let digitsLength = 2;

  for (const m of machines) {
    const code = (m.code || '').trim();
    const match = code.match(regex);
    if (match) {
      const prefix = (match[1] || 'A').toUpperCase();
      const num = parseInt(match[2], 10);
      digitsLength = Math.max(digitsLength, match[2].length);
      if (prefix > maxPrefix || (prefix === maxPrefix && num > maxNum)) {
        maxPrefix = prefix;
        maxNum = num;
      }
    }
  }

  if (maxNum === 0) {
    return `A${String(machines.length + 1).padStart(2, '0')}`;
  }

  const nextNum = maxNum + 1;
  return `${maxPrefix}${String(nextNum).padStart(digitsLength, '0')}`;
}

/**
 * 樂趣功能：統計每個號碼被台主選了幾次當獎項號碼，以及每版下版後總結是「賺錢」還是「虧損」
 * 包含需求 7：個別號碼出貨時機、直接損益 (開出時幣量 - 獎項成本/回錢) 與提前下課虧損統計
 */
export function computeNumberLuckMatrix(boards: ScratchBoard[]): {
  favoriteAndWinList: NumberLuckStat[];
  profitLeaders: NumberLuckStat[];
  lossTrapList: NumberLuckStat[];
  allStats: NumberLuckStat[];
} {
  const map: Record<
    number,
    NumberLuckStat & {
      directExitProfitSum: number;
      earlyLossCount: number;
      exitHolesSum: number;
      exitHolesCount: number;
    }
  > = {};

  for (const board of boards) {
    const fin = calculateScratchBoardFinancials(
      board.board_cost,
      board.gross_coin_revenue,
      board.prizes
    );
    const boardProfit = fin.netProfit;
    const isWinBoard = boardProfit >= 0;

    for (const prize of board.prizes) {
      const num = prize.number_label;
      if (!map[num]) {
        map[num] = {
          number_label: num,
          times_selected: 0,
          times_claimed: 0,
          win_boards_count: 0,
          loss_boards_count: 0,
          win_rate_pct: 0,
          cumulative_board_profit: 0,
          total_cashback_given: 0,
          last_prize_name:
            prize.prize_name ||
            (prize.is_cashback ? `回錢 $${prize.cashback_amount}` : '大獎'),
          directExitProfitSum: 0,
          earlyLossCount: 0,
          exitHolesSum: 0,
          exitHolesCount: 0,
        };
      }

      map[num].times_selected += 1;
      if (prize.prize_name) {
        map[num].last_prize_name = prize.prize_name;
      } else if (prize.is_cashback) {
        map[num].last_prize_name = `回錢 $${prize.cashback_amount}`;
      }

      if (prize.is_claimed) {
        map[num].times_claimed += 1;
        if (prize.is_cashback) {
          map[num].total_cashback_given += Number(prize.cashback_amount) || 0;
        }

        // 需求 7：號碼出貨當下損益分析 (開出時幣量 - 獎品成本或回錢金額)
        const costOrCashback =
          prize.claim_type === 'CASHBACK'
            ? Number(prize.cashback_amount) || 0
            : Number(prize.prize_cost) || 0;
        const revenueAtExit =
          prize.claimed_at_revenue !== undefined
            ? prize.claimed_at_revenue
            : board.gross_coin_revenue;
        const exitProfit = revenueAtExit - costOrCashback;
        map[num].directExitProfitSum += exitProfit;

        // 當開出時即時損益為負，代表該獎號提早出貨造成台主虧損 (提早下課)
        if (exitProfit < 0) {
          map[num].earlyLossCount += 1;
          map[num].loss_boards_count += 1; // 該次開獎為「賠 (敗)」
        } else {
          map[num].win_boards_count += 1;  // 該次開獎為「賺 (勝)」
        }

        const holesAtExit =
          prize.claimed_at_scratched_holes !== undefined
            ? prize.claimed_at_scratched_holes
            : Math.max(0, board.total_holes - board.remaining_holes);
        if (holesAtExit > 0) {
          map[num].exitHolesSum += holesAtExit;
          map[num].exitHolesCount += 1;
        }
      } else if (board.status === 'SETTLED') {
        // 若該板已結算且此獎項未被開出，台主保住獎品成本
        if (boardProfit >= 0) {
          map[num].win_boards_count += 1;
        } else {
          map[num].loss_boards_count += 1;
        }
      }
      // 進行中且尚未開出的號碼，暫不計入賺賠結果

      map[num].cumulative_board_profit += boardProfit;
    }
  }

  const allStats: NumberLuckStat[] = Object.values(map).map((s) => {
    const totalOutcomes = s.win_boards_count + s.loss_boards_count;
    const winRate =
      totalOutcomes > 0 ? Math.round((s.win_boards_count / totalOutcomes) * 100) : 0;
    return {
      number_label: s.number_label,
      times_selected: s.times_selected,
      times_claimed: s.times_claimed,
      win_boards_count: s.win_boards_count,
      loss_boards_count: s.loss_boards_count,
      win_rate_pct: winRate,
      cumulative_board_profit: s.cumulative_board_profit,
      total_cashback_given: s.total_cashback_given,
      last_prize_name: s.last_prize_name,
      direct_exit_profit: s.directExitProfitSum,
      early_exit_loss_count: s.earlyLossCount,
      avg_exit_hole:
        s.exitHolesCount > 0 ? Math.round(s.exitHolesSum / s.exitHolesCount) : undefined,
    };
  });

  // 1. 台主最常選號碼排行 (依被選次數排序)
  const favoriteAndWinList = [...allStats].sort(
    (a, b) =>
      b.times_selected - a.times_selected ||
      b.cumulative_board_profit - a.cumulative_board_profit
  );

  // 2. 帶財神號榜 (開出即時損益為正，且無提早虧損下課紀錄)
  const profitLeaders = allStats
    .filter(
      (s) =>
        (s.direct_exit_profit !== undefined ? s.direct_exit_profit : s.cumulative_board_profit) > 0 &&
        (s.early_exit_loss_count || 0) === 0 &&
        s.win_boards_count > 0
    )
    .sort(
      (a, b) =>
        (b.direct_exit_profit || 0) - (a.direct_exit_profit || 0) ||
        b.win_boards_count - a.win_boards_count
    );

  // 3. 虧損注意號 (開出即時虧損 < 0 或 有提早下課紀錄)
  const lossTrapList = allStats
    .filter(
      (s) =>
        (s.direct_exit_profit || 0) < 0 ||
        (s.early_exit_loss_count || 0) > 0 ||
        s.loss_boards_count > 0
    )
    .sort(
      (a, b) =>
        (a.direct_exit_profit || 0) - (b.direct_exit_profit || 0) ||
        b.loss_boards_count - a.loss_boards_count
    );

  return {
    favoriteAndWinList,
    profitLeaders,
    lossTrapList,
    allStats,
  };
}

export interface OverheadResult {
  totalConfiguredRent: number;   // 機台合約設定應繳月租總額 (合約基準)
  totalPaidRent: number;         // 實際已確認支付之台租與固定費 (自 payment_records)
  totalRent: number;             // 計入淨利扣除的台租實支出 (等於 totalPaidRent，未付絕不預扣)
  totalOtherFixed: number;       // 設定之其他固定費 (供台租管理參考)
  totalConsumableExpenses: number; // 耗材與雜支 (膠帶、爪套、消光膠帶等實質開銷)
  grandTotalOverhead: number;    // 計入損益的總固定開銷支出 = totalPaidRent + totalConsumableExpenses
  unpaidRent: number;            // 當前待繳/未付租金 = Math.max(0, totalConfiguredRent - totalPaidRent)
}

/**
 * 計算機台固定成本 (台租費用 + 其他費用) 與選用耗材費用
 * 業務規則：新增機台後不預先從淨利扣除月租，必須於「台租」頁面確認支付 (PAID) 後才計入損益扣除，避免誤算！
 */
export function calculateSimpleOverhead(
  machines: Machine[],
  expenses: Expense[],
  targetMachineId: string | 'ALL' = 'ALL',
  options?: {
    dateRange?: { start: Date; end: Date } | null;
    currentPeriodMonth?: string;
  }
): OverheadResult {
  const targetMachines =
    targetMachineId === 'ALL'
      ? machines
      : machines.filter((m) => m.machine_id === targetMachineId);

  // 1. 合約設定之月租 (作為待繳與合約基準)
  const totalConfiguredRent = targetMachines.reduce(
    (s, m) => s + (Number(m.rent_monthly) || 0),
    0
  );

  // 2. 實繳台租：台主必須於台租頁面點擊「登記已付 / 確認記錄已付款」產生的付款紀錄
  // 嚴格遵守台主業務財務邏輯：未去台租頁面確認支付者，絕不預扣當月租金！
  const totalPaidRent = targetMachines.reduce((s, m) => {
    const paidRecords = (m.payment_records || []).filter((r) => {
      // 狀態為 PAID 或無狀態 (相容舊資料)
      if (r.status && r.status !== 'PAID') return false;

      // 若指定月份 (例如 "2026-11")
      if (options?.currentPeriodMonth && r.period_label) {
        return r.period_label === options.currentPeriodMonth;
      }

      // 若指定日期範圍 (例如週、年或自訂範圍)
      if (options?.dateRange) {
        const t = new Date(r.paid_at || 0).getTime();
        if (isNaN(t)) return true;
        return (
          t >= options.dateRange.start.getTime() &&
          t <= options.dateRange.end.getTime()
        );
      }

      return true;
    });

    const sumPaid = paidRecords.reduce(
      (rs, r) => rs + (Number(r.amount) || 0),
      0
    );
    return s + sumPaid;
  }, 0);

  const totalOtherFixed = targetMachines.reduce((s, m) => {
    const customFeesSum = (m.custom_fixed_fees || []).reduce(
      (cfs, f) => cfs + (Number(f.amount) || 0),
      0
    );
    return s + (Number(m.other_fixed_fee) || 0) + customFeesSum;
  }, 0);

  const activeCount = Math.max(1, machines.length);
  let totalConsumableExpenses = 0;

  for (const exp of expenses) {
    if (targetMachineId === 'ALL') {
      totalConsumableExpenses += Number(exp.amount) || 0;
    } else if (exp.machine_id === targetMachineId) {
      totalConsumableExpenses += Number(exp.amount) || 0;
    } else if (exp.machine_id === null) {
      totalConsumableExpenses += Math.round(
        (Number(exp.amount) || 0) / activeCount
      );
    }
  }

  // 損益扣除額以「實際已確認支付之台租 (totalPaidRent)」加上「實質耗材雜支」
  const grandTotalOverhead = totalPaidRent + totalConsumableExpenses;
  const unpaidRent = Math.max(0, totalConfiguredRent - totalPaidRent);

  return {
    totalConfiguredRent,
    totalPaidRent,
    totalRent: totalPaidRent, // 保留相容性，使原有引用 totalRent 者均使用實付台租
    totalOtherFixed,
    totalConsumableExpenses,
    grandTotalOverhead,
    unpaidRent,
  };
}

/**
 * 動態產生擬真 6 位數機械計數器照片 (供類比台測試 AI 辨識)
 */
export function generateSampleMeterPhotoBase64(
  coinVal: number,
  prizeVal: number,
  machineCode: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#181c24';
  ctx.fillRect(0, 0, 640, 420);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`ANALOG METER UNIT - MACHINE [${machineCode}]`, 36, 42);

  const drawCounterBox = (
    y: number,
    label: string,
    subLabel: string,
    val: number,
    accent: string
  ) => {
    const digits = formatSixDigit(val).split('');

    ctx.fillStyle = '#0b0e14';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.fillRect(36, y, 568, 140);
    ctx.strokeRect(36, y, 568, 140);

    ctx.fillStyle = accent;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(label, 56, y + 36);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText(subLabel, 56, y + 60);

    const startX = 220;
    const wheelW = 54;
    const wheelH = 76;
    const wheelY = y + 32;

    digits.forEach((d, idx) => {
      const wx = startX + idx * (wheelW + 6);
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(wx, wheelY, wheelW, wheelH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wheelY, wheelW, wheelH);

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(wx + 2, wheelY + 2, wheelW - 4, 16);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 46px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d, wx + wheelW / 2, wheelY + wheelH / 2 + 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    });
  };

  drawCounterBox(70, 'COIN IN 投幣錶', 'DC 12V 6-DIGIT COUNTER', coinVal, '#f59e0b');
  drawCounterBox(240, 'PRIZE OUT 出貨錶', 'OPTICAL SENSOR COUNTER', prizeVal, '#10b981');

  return canvas.toDataURL('image/jpeg', 0.92);
}
