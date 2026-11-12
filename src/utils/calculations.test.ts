import { describe, expect, it } from 'bun:test';
import { calculateSimpleOverhead, calculateScratchBoardFinancials, formatProfit } from './calculations';
import { Machine, Expense } from '../types';

describe('calculateSimpleOverhead (台租只在確認支付後才計入淨利扣除)', () => {
  const dummyMachine: Machine = {
    machine_id: 'm1',
    code: 'C01',
    name: '測試機台',
    machine_model: 'DIGITAL',
    location: '逢甲店',
    rent_monthly: 4500,
    other_fixed_fee: 0,
    coin_unit_value: 10,
    last_coin_counter: 0,
    last_prize_counter: 0,
    last_read_at: new Date().toISOString(),
    is_active: true,
    payment_records: [],
  };

  it('新增機台後尚未確認支付時，實付台租為 0，絕不預扣淨利', () => {
    const result = calculateSimpleOverhead([dummyMachine], [], 'ALL');
    expect(result.totalConfiguredRent).toBe(4500);
    expect(result.totalPaidRent).toBe(0);
    expect(result.totalRent).toBe(0);
    expect(result.grandTotalOverhead).toBe(0);
    expect(result.unpaidRent).toBe(4500);
  });

  it('台主於台租頁面確認支付後 (PAID)，才計入實付台租與總支出扣除', () => {
    const paidMachine: Machine = {
      ...dummyMachine,
      payment_records: [
        {
          payment_id: 'pay_1',
          machine_id: 'm1',
          title: '2026-11 台租',
          amount: 4500,
          paid_at: '2026-11-09T12:00:00.000Z',
          period_label: '2026-11',
          status: 'PAID',
        },
      ],
    };

    const result = calculateSimpleOverhead([paidMachine], [], 'ALL');
    expect(result.totalConfiguredRent).toBe(4500);
    expect(result.totalPaidRent).toBe(4500);
    expect(result.totalRent).toBe(4500);
    expect(result.grandTotalOverhead).toBe(4500);
    expect(result.unpaidRent).toBe(0);
  });

  it('待繳 (PENDING) 狀態的紀錄不會被扣除', () => {
    const pendingMachine: Machine = {
      ...dummyMachine,
      payment_records: [
        {
          payment_id: 'pay_2',
          machine_id: 'm1',
          title: '2026-11 台租待繳',
          amount: 4500,
          paid_at: '2026-11-09T12:00:00.000Z',
          period_label: '2026-11',
          status: 'PENDING',
        },
      ],
    };

    const result = calculateSimpleOverhead([pendingMachine], [], 'ALL');
    expect(result.totalPaidRent).toBe(0);
    expect(result.grandTotalOverhead).toBe(0);
    expect(result.unpaidRent).toBe(4500);
  });

  it('月份篩選時只統計該月份的已付台租', () => {
    const multiMonthMachine: Machine = {
      ...dummyMachine,
      payment_records: [
        {
          payment_id: 'pay_oct',
          machine_id: 'm1',
          title: '2026-10 台租',
          amount: 4500,
          paid_at: '2026-10-05T12:00:00.000Z',
          period_label: '2026-10',
          status: 'PAID',
        },
        {
          payment_id: 'pay_nov',
          machine_id: 'm1',
          title: '2026-11 台租',
          amount: 4500,
          paid_at: '2026-11-05T12:00:00.000Z',
          period_label: '2026-11',
          status: 'PAID',
        },
      ],
    };

    const novResult = calculateSimpleOverhead([multiMonthMachine], [], 'ALL', {
      currentPeriodMonth: '2026-11',
    });
    expect(novResult.totalPaidRent).toBe(4500);

    const decResult = calculateSimpleOverhead([multiMonthMachine], [], 'ALL', {
      currentPeriodMonth: '2026-12',
    });
    expect(decResult.totalPaidRent).toBe(0);
    expect(decResult.unpaidRent).toBe(4500);
  });
});

describe('computeNumberLuckMatrix (號碼直接損益與勝率計算)', () => {
  it('當獎號提早出貨造成虧損 (-200) 時，應統計為 1 敗 / 0 勝，勝率 0%，且歸類為虧損注意號而非帶財神號', () => {
    const { computeNumberLuckMatrix } = require('./calculations');
    const board = {
      board_id: 'b1',
      machine_id: 'm1',
      title: 'A01 A板',
      total_holes: 80,
      remaining_holes: 70,
      board_cost: 0,
      status: 'ACTIVE',
      gross_coin_revenue: 100,
      total_cashback_deducted: 300,
      prizes: [
        {
          item_id: 'p17',
          number_label: 17,
          prize_name: '提早出貨大獎',
          is_cashback: true,
          cashback_amount: 300,
          prizeCost: 0,
          is_claimed: true,
          claim_type: 'CASHBACK',
          claimed_at_revenue: 100, // 開出時幣量 100，回錢 300 -> 損益 -200
          claimed_at_scratched_holes: 10,
        },
      ],
      created_at: new Date().toISOString(),
    };

    const stats = computeNumberLuckMatrix([board]);
    const num17 = stats.allStats.find((s: any) => s.number_label === 17);

    expect(num17).toBeDefined();
    expect(num17.times_claimed).toBe(1);
    expect(num17.direct_exit_profit).toBe(-200);
    expect(num17.early_exit_loss_count).toBe(1);
    expect(num17.loss_boards_count).toBe(1);
    expect(num17.win_boards_count).toBe(0);
    expect(num17.win_rate_pct).toBe(0);

    // 絕不可出現在帶財神號榜
    expect(stats.profitLeaders.some((s: any) => s.number_label === 17)).toBe(false);

    // 必須出現在虧損注意號榜
    expect(stats.lossTrapList.some((s: any) => s.number_label === 17)).toBe(true);
  });

  it('當獎號在足夠幣量後才出貨獲利 (+500) 時，應統計為 1 勝 / 0 敗，勝率 100%，並名列帶財神號', () => {
    const { computeNumberLuckMatrix } = require('./calculations');
    const board = {
      board_id: 'b2',
      machine_id: 'm1',
      title: 'A01 B板',
      total_holes: 80,
      remaining_holes: 20,
      board_cost: 0,
      status: 'ACTIVE',
      gross_coin_revenue: 800,
      total_cashback_deducted: 300,
      prizes: [
        {
          item_id: 'p88',
          number_label: 88,
          prize_name: '帶財大獎',
          is_cashback: true,
          cashback_amount: 300,
          prizeCost: 0,
          is_claimed: true,
          claim_type: 'CASHBACK',
          claimed_at_revenue: 800, // 開出時幣量 800，回錢 300 -> 損益 +500
          claimed_at_scratched_holes: 60,
        },
      ],
      created_at: new Date().toISOString(),
    };

    const stats = computeNumberLuckMatrix([board]);
    const num88 = stats.allStats.find((s: any) => s.number_label === 88);

    expect(num88).toBeDefined();
    expect(num88.times_claimed).toBe(1);
    expect(num88.direct_exit_profit).toBe(500);
    expect(num88.early_exit_loss_count).toBe(0);
    expect(num88.win_boards_count).toBe(1);
    expect(num88.loss_boards_count).toBe(0);
    expect(num88.win_rate_pct).toBe(100);

    // 必須出現在帶財神號榜
    expect(stats.profitLeaders.some((s: any) => s.number_label === 88)).toBe(true);

    // 絕不可出現在虧損注意號榜
    expect(stats.lossTrapList.some((s: any) => s.number_label === 88)).toBe(false);
  });
});

describe('calculateScratchBoardFinancials (拿獎 vs 回錢 損益對等與毛收幣不足時正確呈現負損益)', () => {
  it('當回錢 (1500) 大於毛收幣 (500) 時，淨利應為 -1000，不可截斷為 0', () => {
    const fin = calculateScratchBoardFinancials(0, 500, [
      {
        item_id: 'p1',
        number_label: 1,
        is_claimed: true,
        claim_type: 'CASHBACK',
        cashback_amount: 1500,
        prize_cost: 0,
      },
    ]);

    expect(fin.grossCoinRevenue).toBe(500);
    expect(fin.totalCashbackDeducted).toBe(1500);
    expect(fin.netCoinRevenue).toBe(-1000);
    expect(fin.netProfit).toBe(-1000);
  });

  it('拿獎 (扣成本 1000) 與 回錢 (給付現金 1000) 對台主淨利損益影響完全對等', () => {
    const finPhysical = calculateScratchBoardFinancials(0, 1500, [
      {
        item_id: 'p_phys',
        number_label: 2,
        is_claimed: true,
        claim_type: 'PHYSICAL',
        prize_cost: 1000,
        cashback_amount: 1000,
      },
    ]);

    const finCashback = calculateScratchBoardFinancials(0, 1500, [
      {
        item_id: 'p_cash',
        number_label: 3,
        is_claimed: true,
        claim_type: 'CASHBACK',
        prize_cost: 1000,
        cashback_amount: 1000,
      },
    ]);

    // 兩者淨利皆應為 1500 - 1000 = 500
    expect(finPhysical.netProfit).toBe(500);
    expect(finCashback.netProfit).toBe(500);
    expect(finPhysical.netProfit).toBe(finCashback.netProfit);
  });
});

describe('formatProfit (金額正負號與字串防呆)', () => {
  it('正數應以 +$ 前綴呈現', () => {
    expect(formatProfit(500)).toBe('+$500');
    expect(formatProfit(1400)).toBe('+$1,400');
  });

  it('負數應以 -$ 前綴呈現，絕不可輸出 +$-200 或 $-200', () => {
    expect(formatProfit(-200)).toBe('-$200');
    expect(formatProfit(-1400)).toBe('-$1,400');
  });

  it('0 應輸出 +$0', () => {
    expect(formatProfit(0)).toBe('+$0');
  });
});

describe('computeMonthlyFinancialTrends (近6個月損益與雙棲混營趨勢計算)', () => {
  const { computeMonthlyFinancialTrends } = require('./calculations');

  const mockMachines = [
    {
      machine_id: 'm_std',
      code: 'A01',
      name: '純公仔機',
      machine_type: 'STANDARD',
      rent_monthly: 4000,
      is_active: true,
      payment_records: [
        {
          payment_id: 'p1',
          machine_id: 'm_std',
          title: '2026-11 台租',
          amount: 4000,
          period_label: '2026-11',
          status: 'PAID',
          paid_at: '2026-11-01T08:00:00Z',
        },
      ],
    },
    {
      machine_id: 'm_scratch',
      code: 'B01',
      name: '一番賞刮板機',
      machine_type: 'SCRATCH_HYBRID',
      rent_monthly: 5000,
      is_active: true,
      payment_records: [
        {
          payment_id: 'p2',
          machine_id: 'm_scratch',
          title: '2026-11 台租',
          amount: 5000,
          period_label: '2026-11',
          status: 'PAID',
          paid_at: '2026-11-01T08:00:00Z',
        },
      ],
    },
  ];

  const mockReadings = [
    {
      machine_id: 'm_std',
      read_at: '2026-11-05T12:00:00Z',
      revenue_amount: 12000,
      prize_delta: 20,
    },
    {
      machine_id: 'm_scratch',
      read_at: '2026-11-06T12:00:00Z',
      revenue_amount: 18000,
      prize_delta: 10,
    },
  ];

  const mockBoards = [
    {
      board_id: 'b1',
      machine_id: 'm_scratch',
      title: 'B01 A板',
      status: 'ACTIVE',
      prizes: [
        {
          item_id: 'prz1',
          number_label: 1,
          is_claimed: true,
          claimed_at: '2026-11-06T14:00:00Z',
          claim_type: 'PHYSICAL',
          prize_cost: 3000,
          is_cashback: false,
          cashback_amount: 0,
        },
        {
          item_id: 'prz2',
          number_label: 2,
          is_claimed: true,
          claimed_at: '2026-11-07T14:00:00Z',
          claim_type: 'CASHBACK',
          prize_cost: 0,
          is_cashback: true,
          cashback_amount: 1000,
        },
      ],
    },
  ];

  it('預設全場合併計算時，總收幣應涵蓋純機台與刮板機，正確扣除台租、商品成本與回錢', () => {
    const trends = computeMonthlyFinancialTrends(
      mockReadings,
      mockMachines,
      [],
      mockBoards,
      { monthsCount: 6, referenceDate: new Date('2026-11-15T00:00:00Z'), fleetFilter: 'ALL' }
    );

    expect(trends.length).toBe(6);
    const nov = trends.find((t) => t.period_label === '2026-11');
    expect(nov).toBeDefined();

    // 總收幣 = 12000 (純機) + 18000 (刮板) = 30000
    expect(nov?.gross_coin_revenue).toBe(30000);
    expect(nov?.standard_machine_revenue).toBe(12000);
    expect(nov?.scratch_machine_revenue).toBe(18000);

    // 獎品成本 = 3000, 回錢 = 1000, 台租 = 4000 + 5000 = 9000
    expect(nov?.product_cost).toBe(3000);
    expect(nov?.cashback_deducted).toBe(1000);
    expect(nov?.rent_and_overhead).toBe(9000);

    // 淨利 = 30000 - 3000 - 1000 - 9000 = 17000
    expect(nov?.net_profit).toBe(17000);
    expect(nov?.payout_count).toBe(30);
  });

  it('切換為只看純娃娃機時，應僅包含純機台營收與台租，排除刮板獎品與回錢', () => {
    const trends = computeMonthlyFinancialTrends(
      mockReadings,
      mockMachines,
      [],
      mockBoards,
      { monthsCount: 6, referenceDate: new Date('2026-11-15T00:00:00Z'), fleetFilter: 'STANDARD' }
    );

    const nov = trends.find((t) => t.period_label === '2026-11');
    expect(nov?.gross_coin_revenue).toBe(12000);
    expect(nov?.standard_machine_revenue).toBe(12000);
    expect(nov?.scratch_machine_revenue).toBe(0);
    expect(nov?.product_cost).toBe(0);
    expect(nov?.cashback_deducted).toBe(0);
    expect(nov?.rent_and_overhead).toBe(4000);
    expect(nov?.net_profit).toBe(8000); // 12000 - 4000
  });

  it('切換為只看刮板機台時，應僅包含刮板機台營收、台租、獎品成本與回錢', () => {
    const trends = computeMonthlyFinancialTrends(
      mockReadings,
      mockMachines,
      [],
      mockBoards,
      { monthsCount: 6, referenceDate: new Date('2026-11-15T00:00:00Z'), fleetFilter: 'SCRATCH_HYBRID' }
    );

    const nov = trends.find((t) => t.period_label === '2026-11');
    expect(nov?.gross_coin_revenue).toBe(18000);
    expect(nov?.standard_machine_revenue).toBe(0);
    expect(nov?.scratch_machine_revenue).toBe(18000);
    expect(nov?.product_cost).toBe(3000);
    expect(nov?.cashback_deducted).toBe(1000);
    expect(nov?.rent_and_overhead).toBe(5000);
    expect(nov?.net_profit).toBe(9000); // 18000 - 3000 - 1000 - 5000 = 9000
  });

  it('雜項開銷 (Expense) 正確依 incurred_date 納入台租與固定開銷扣除', () => {
    const mockExpenses = [
      {
        expense_id: 'exp1',
        machine_id: 'm_std',
        title: '爪套彈力繩',
        amount: 500,
        is_advanced_amortized: false,
        spread_days: 0,
        incurred_date: '2026-11-04T10:00:00Z',
        note: '',
      },
      {
        expense_id: 'exp2',
        machine_id: null, // 全場共用
        title: '全場公家電費',
        amount: 1200,
        is_advanced_amortized: false,
        spread_days: 0,
        incurred_date: '2026-11-04T10:00:00Z',
        note: '',
      },
    ];

    const trends = computeMonthlyFinancialTrends(
      mockReadings,
      mockMachines,
      mockExpenses as any,
      mockBoards,
      { monthsCount: 6, referenceDate: new Date('2026-11-15T00:00:00Z'), fleetFilter: 'ALL' }
    );

    const nov = trends.find((t) => t.period_label === '2026-11');
    // 台租 9000 + 爪套 500 + 全場電費 1200 = 10700
    expect(nov?.rent_and_overhead).toBe(10700);
    // 淨利 = 30000 - 3000 - 1000 - 10700 = 15300
    expect(nov?.net_profit).toBe(15300);
  });

  it('當月無營收時，淨利率應安全防呆為 0%，絕不輸出 NaN 或 Infinity', () => {
    const trends = computeMonthlyFinancialTrends(
      [],
      mockMachines,
      [],
      [],
      { monthsCount: 6, referenceDate: new Date('2026-11-15T00:00:00Z'), fleetFilter: 'ALL' }
    );

    const nov = trends.find((t) => t.period_label === '2026-11');
    expect(nov?.gross_coin_revenue).toBe(0);
    expect(nov?.net_margin_pct).toBe(0);
    expect(isNaN(nov?.net_margin_pct || 0)).toBe(false);
  });
});
