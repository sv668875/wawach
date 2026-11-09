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
