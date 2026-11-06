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

  const netCoinRevenue = Math.max(0, (Number(grossCoinRevenue) || 0) - totalCashbackDeducted);
  const netProfit =
    netCoinRevenue - claimedPrizeCost - (Number(boardCost) || 0);

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
 * 樂趣功能：統計每個號碼被台主選了幾次當獎項號碼，以及每版下版後總結是「賺錢」還是「虧損」
 */
export function computeNumberLuckMatrix(boards: ScratchBoard[]): {
  favoriteAndWinList: NumberLuckStat[];
  profitLeaders: NumberLuckStat[];
  lossTrapList: NumberLuckStat[];
  allStats: NumberLuckStat[];
} {
  const map: Record<number, NumberLuckStat> = {};

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
      }

      // 統計該板總結是賺錢還是虧損
      if (isWinBoard) {
        map[num].win_boards_count += 1;
      } else {
        map[num].loss_boards_count += 1;
      }
      map[num].cumulative_board_profit += boardProfit;
    }
  }

  const allStats = Object.values(map).map((s) => {
    const totalBoards = s.win_boards_count + s.loss_boards_count;
    const winRate =
      totalBoards > 0 ? Math.round((s.win_boards_count / totalBoards) * 100) : 0;
    return {
      ...s,
      win_rate_pct: winRate,
    };
  });

  // 1. 台主最常選號碼排行 (依被選次數排序)
  const favoriteAndWinList = [...allStats].sort(
    (a, b) =>
      b.times_selected - a.times_selected ||
      b.cumulative_board_profit - a.cumulative_board_profit
  );

  // 2. 帶財神號榜 (依總賺錢金額排序)
  const profitLeaders = allStats
    .filter((s) => s.cumulative_board_profit > 0)
    .sort((a, b) => b.cumulative_board_profit - a.cumulative_board_profit);

  // 3. 虧損地雷號 (有敗場或總結虧損的號碼)
  const lossTrapList = allStats
    .filter((s) => s.loss_boards_count > 0 || s.cumulative_board_profit < 0)
    .sort((a, b) => a.cumulative_board_profit - b.cumulative_board_profit);

  return {
    favoriteAndWinList,
    profitLeaders,
    lossTrapList,
    allStats,
  };
}

/**
 * 計算機台固定成本 (台租費用 + 其他費用) 與選用耗材費用
 */
export function calculateSimpleOverhead(
  machines: Machine[],
  expenses: Expense[],
  targetMachineId: string | 'ALL'
): {
  totalRent: number;
  totalOtherFixed: number;
  totalConsumableExpenses: number;
  grandTotalOverhead: number;
} {
  const targetMachines =
    targetMachineId === 'ALL'
      ? machines
      : machines.filter((m) => m.machine_id === targetMachineId);

  const totalRent = targetMachines.reduce(
    (s, m) => s + (Number(m.rent_monthly) || 0),
    0
  );
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

  return {
    totalRent,
    totalOtherFixed,
    totalConsumableExpenses,
    grandTotalOverhead: totalRent + totalOtherFixed + totalConsumableExpenses,
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
