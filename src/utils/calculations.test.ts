import { describe, expect, it } from 'bun:test';
import { calculateSimpleOverhead } from './calculations';
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
