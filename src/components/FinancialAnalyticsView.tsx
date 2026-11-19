import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Download,
  Upload,
  RotateCcw,
  Grid,
  BarChart3,
  PieChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Check,
  X,
  Trash2,
  Layers,
  Building,
  Building2,
  Filter,
  Package,
  Ticket,
  Box,
  ArrowDownLeft,
  Target,
  Wallet,
} from 'lucide-react';
import {
  CoinBoxWithdrawal,
  CoinWithdrawalPurpose,
  Expense,
  FleetFilter,
  InventoryItem,
  Machine,
  MeterReading,
  MonthlyFinancialTrend,
  ScratchBoard,
} from '../types';
import {
  calculateCoinBoxSummary,
  calculateScratchBoardFinancials,
  calculateSimpleOverhead,
  computeMonthlyFinancialTrends,
  formatProfit,
} from '../utils/calculations';

interface FinancialAnalyticsViewProps {
  machines: Machine[];
  readings: MeterReading[];
  scratchBoards: ScratchBoard[];
  inventoryItems: InventoryItem[];
  expenses: Expense[];
  coinBoxWithdrawals?: CoinBoxWithdrawal[];
  onWithdrawCoinBox?: (payload: {
    machineId: string | 'ALL';
    amount?: number;
    purpose?: CoinWithdrawalPurpose;
    note?: string;
  }) => void;
  activeMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonData: any, mode: 'OVERWRITE' | 'MERGE') => void;
  onResetDemoData: () => void;
  onResetEntireApp: () => void;
}

type PeriodType = 'ALL' | 'WEEK' | 'MONTH' | 'YEAR';
type DetailTab = 'MACHINE' | 'VENUE' | 'BOARD';

function getWeekRange(refDate: Date) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

export const FinancialAnalyticsView: React.FC<FinancialAnalyticsViewProps> = ({
  machines,
  readings,
  scratchBoards,
  inventoryItems,
  expenses,
  coinBoxWithdrawals = [],
  onWithdrawCoinBox,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onResetDemoData,
  onResetEntireApp,
}) => {
  // 需求 7：時間區間篩選狀態
  const now = useMemo(() => new Date(), []);
  const [periodType, setPeriodType] = useState<PeriodType>('ALL');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  // 損益明細頁籤 (依機台 / 依場地 / 依刮板)
  const [detailTab, setDetailTab] = useState<DetailTab>('MACHINE');
  const [selectedVenueFilter, setSelectedVenueFilter] = useState<string>('ALL');
  const [boardStatusFilter, setBoardStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SETTLED'
  >('ALL');

  // 近 6 個月損益趨勢狀態
  const [selectedTrendMonthKey, setSelectedTrendMonthKey] = useState<string>('');
  const [isSixMonthTrendExpanded, setIsSixMonthTrendExpanded] = useState<boolean>(false);
  const [isCoinBoxExpanded, setIsCoinBoxExpanded] = useState<boolean>(false);
  const [isMaintenanceExpanded, setIsMaintenanceExpanded] = useState<boolean>(false);

  const mappedReadings = useMemo(() => {
    return readings.map((r) => ({
      machine_id: r.machine_id,
      read_at: r.read_at,
      revenue_amount: r.cash_collected || r.panel_amount || 0,
      prize_delta: r.prizes_delta || 0,
      board_id: r.board_id,
    }));
  }, [readings]);

  const monthlyTrends = useMemo(() => {
    return computeMonthlyFinancialTrends(
      mappedReadings,
      machines,
      expenses,
      scratchBoards,
      {
        monthsCount: 6,
        fleetFilter: 'ALL',
      }
    );
  }, [mappedReadings, machines, expenses, scratchBoards]);

  const activeTrendMonth = useMemo(() => {
    if (selectedTrendMonthKey) {
      const match = monthlyTrends.find((m) => m.period_label === selectedTrendMonthKey);
      if (match) return match;
    }
    return monthlyTrends[monthlyTrends.length - 1] || null;
  }, [monthlyTrends, selectedTrendMonthKey]);

  // 需求 8：匯入 JSON 預覽與確認狀態
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedDataPreview, setImportedDataPreview] = useState<any | null>(null);

  // 需求 2：全系統初始化清空確認彈窗狀態
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // 計算選中期間的起訖日期範圍
  const dateRange = useMemo(() => {
    if (periodType === 'ALL') return null;

    if (periodType === 'WEEK') {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + weekOffset * 7);
      return getWeekRange(targetDate);
    }

    if (periodType === 'MONTH') {
      const start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (periodType === 'YEAR') {
      const start = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      const end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      return { start, end };
    }

    return null;
  }, [periodType, weekOffset, selectedYear, selectedMonth]);
  // 錢箱現有餘額與取出總額彙總
  const coinBoxSummary = useMemo(() => {
    const rangeMs = dateRange
      ? { start: dateRange.start.getTime(), end: dateRange.end.getTime() }
      : null;
    return calculateCoinBoxSummary(machines, coinBoxWithdrawals, rangeMs);
  }, [machines, coinBoxWithdrawals, dateRange]);

  // 依時間區間篩選資料 (需求 7)
  const filteredReadings = useMemo(() => {
    if (!dateRange) return readings;
    return readings.filter((r) => {
      const t = new Date(r.read_at).getTime();
      return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
    });
  }, [readings, dateRange]);

  const filteredBoards = useMemo(() => {
    if (!dateRange) return scratchBoards;
    return scratchBoards.filter((b) => {
      const createdT = new Date(b.created_at).getTime();
      const settledT = b.settled_at ? new Date(b.settled_at).getTime() : 0;
      const inCreated = !isNaN(createdT) && createdT >= dateRange.start.getTime() && createdT <= dateRange.end.getTime();
      const inSettled = !isNaN(settledT) && settledT >= dateRange.start.getTime() && settledT <= dateRange.end.getTime();
      const hasLogsInRange = (b.check_logs || []).some((l) => {
        const lt = new Date(l.logged_at).getTime();
        return !isNaN(lt) && lt >= dateRange.start.getTime() && lt <= dateRange.end.getTime();
      });
      const hasPrizesInRange = (b.prizes || []).some((p) => {
        if (!p.is_claimed || !p.claimed_at) return false;
        const pt = new Date(p.claimed_at).getTime();
        return !isNaN(pt) && pt >= dateRange.start.getTime() && pt <= dateRange.end.getTime();
      });
      return inCreated || inSettled || hasLogsInRange || hasPrizesInRange || b.status === 'ACTIVE';
    });
  }, [scratchBoards, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!dateRange) return expenses;
    return expenses.filter((e) => {
      const t = new Date(e.incurred_date).getTime();
      return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
    });
  }, [expenses, dateRange]);

  const currentPeriodMonthStr = useMemo(() => {
    if (periodType === 'MONTH') {
      return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    }
    return undefined;
  }, [periodType, selectedYear, selectedMonth]);

  const analytics = useMemo(() => {
    const rawOverhead = calculateSimpleOverhead(machines, filteredExpenses, 'ALL', {
      dateRange,
      currentPeriodMonth: currentPeriodMonthStr,
    });
    const adjustedGrandOverhead = rawOverhead.grandTotalOverhead;

    const machineBreakdown = machines.map((m) => {
      const mBoards = filteredBoards.filter((b) => b.machine_id === m.machine_id);
      const mReadings = filteredReadings.filter((r) => r.machine_id === m.machine_id);
      const mRawOverhead = calculateSimpleOverhead(machines, filteredExpenses, m.machine_id, {
        dateRange,
        currentPeriodMonth: currentPeriodMonthStr,
      });
      const mAdjustedOverhead = mRawOverhead.grandTotalOverhead;

      let grossRevenue = 0;
      let cashbackDeducted = 0;
      let prizeCost = 0;
      let paperCost = 0;

      if (!dateRange) {
        // 全場累計維度 (ALL TIME)
        mBoards.forEach((b) => {
          const fin = calculateScratchBoardFinancials(
            b.board_cost,
            b.gross_coin_revenue,
            b.prizes
          );
          grossRevenue += fin.grossCoinRevenue;
          cashbackDeducted += fin.totalCashbackDeducted;
          prizeCost += fin.claimedPrizeCost;
          paperCost += Number(b.board_cost) || 0;
        });

        const standaloneReadingsRevenue = mReadings
          .filter((r) => !r.board_id)
          .reduce((sum, r) => sum + (Number(r.cash_collected || r.panel_amount) || 0), 0);
        grossRevenue += standaloneReadingsRevenue;
      } else {
        // 指定期間維度 (MONTH / WEEK / YEAR)：嚴格以該區間內發生的收幣與支出事件結算，保證與月度總結完全吻合
        const rangeStart = dateRange.start.getTime();
        const rangeEnd = dateRange.end.getTime();

        // 1. 該區間內此機台所有收幣抄錶紀錄 (包含純機抄錶與刮板收幣)
        mReadings.forEach((r) => {
          grossRevenue += Number(r.cash_collected || r.panel_amount) || 0;
        });

        // 2. 該區間內刮板巡場收幣 (若尚未在 readings 中)
        mBoards.forEach((b) => {
          (b.check_logs || []).forEach((log) => {
            const cash = Number(log.recorded_cash_added) || 0;
            if (cash <= 0) return;
            const lt = new Date(log.logged_at).getTime();
            if (isNaN(lt) || lt < rangeStart || lt > rangeEnd) return;
            const isAlreadyInReadings = mReadings.some(
              (r) =>
                r.board_id === b.board_id &&
                Math.abs(new Date(r.read_at).getTime() - lt) < 60_000 &&
                (r.cash_collected === cash || r.panel_amount === cash)
            );
            if (!isAlreadyInReadings) {
              grossRevenue += cash;
            }
          });

          // 若刮板建立於該區間，補齊未被 readings/check_logs 覆蓋的差額
          const bCreated = new Date(b.created_at).getTime();
          if (!isNaN(bCreated) && bCreated >= rangeStart && bCreated <= rangeEnd) {
            paperCost += Number(b.board_cost) || 0;
            const boardTotalGross = Number(b.gross_coin_revenue) || 0;
            const allLogsSum = (b.check_logs || []).reduce(
              (s, l) => s + (Number(l.recorded_cash_added) || 0),
              0
            );
            const allReadingsSum = readings
              .filter((r) => r.board_id === b.board_id)
              .reduce((s, r) => s + (Number(r.cash_collected || r.panel_amount) || 0), 0);
            const maxCaptured = Math.max(allLogsSum, allReadingsSum);
            const diff = Math.max(0, boardTotalGross - maxCaptured);
            if (diff > 0) {
              grossRevenue += diff;
            }
          }

          // 3. 該區間內中獎開出的獎項成本與回錢折現
          (b.prizes || []).forEach((p) => {
            if (!p.is_claimed) return;
            const claimDateStr = p.claimed_at || b.settled_at || b.created_at;
            const ct = new Date(claimDateStr).getTime();
            if (isNaN(ct) || ct < rangeStart || ct > rangeEnd) return;
            if (p.claim_type === 'CASHBACK') {
              cashbackDeducted += Number(p.cashback_amount) || 0;
            } else {
              prizeCost += Number(p.prize_cost) || 0;
            }
          });
        });
      }

      const netRevenueAfterCashback = grossRevenue - cashbackDeducted;
      const totalDirectPrizeCost = prizeCost + paperCost;
      const netProfit =
        netRevenueAfterCashback -
        totalDirectPrizeCost -
        mAdjustedOverhead;

      return {
        machine: m,
        boardsCount: mBoards.length,
        grossRevenue,
        cashbackDeducted,
        netRevenueAfterCashback,
        totalDirectPrizeCost,
        fixedOverhead: mAdjustedOverhead,
        configuredMonthlyRent: Number(m.rent_monthly) || 0,
        paidRent: mRawOverhead.totalPaidRent,
        netProfit,
      };
    });

    const totalGrossRevenue = machineBreakdown.reduce(
      (s, item) => s + item.grossRevenue,
      0
    );
    const totalCashbackDeducted = machineBreakdown.reduce(
      (s, item) => s + item.cashbackDeducted,
      0
    );
    const totalNetRevenue = machineBreakdown.reduce(
      (s, item) => s + item.netRevenueAfterCashback,
      0
    );
    const totalPrizeCost = machineBreakdown.reduce(
      (s, item) => s + item.totalDirectPrizeCost,
      0
    );
    const trueNetProfit =
      totalNetRevenue - totalPrizeCost - adjustedGrandOverhead;

    const maxMachineRevenue = Math.max(
      1,
      ...machineBreakdown.map((m) => m.grossRevenue)
    );

    return {
      totalGrossRevenue,
      totalCashbackDeducted,
      totalNetRevenue,
      totalPrizeCost,
      grandTotalOverhead: adjustedGrandOverhead,
      overhead: { grandTotalOverhead: adjustedGrandOverhead },
      trueNetProfit,
      maxMachineRevenue,
      machineBreakdown,
    };
  }, [machines, filteredReadings, filteredBoards, filteredExpenses, dateRange, currentPeriodMonthStr]);

  // 計算營收結構百分比 (用於視覺化量表)
  const baseGross = Math.max(1, analytics.totalGrossRevenue);
  const cashbackPct = Math.min(
    100,
    Math.round((analytics.totalCashbackDeducted / baseGross) * 100)
  );
  const prizeCostPct = Math.min(
    100,
    Math.round((analytics.totalPrizeCost / baseGross) * 100)
  );
  const rentPct = Math.min(
    100,
    Math.round((analytics.grandTotalOverhead / baseGross) * 100)
  );
  const profitPct = Math.max(
    0,
    100 - cashbackPct - prizeCostPct - rentPct
  );

  // 需求 10：全場獨立店點/場地列表
  const uniqueVenues = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => {
      if (m.location && m.location.trim()) {
        set.add(m.location.trim());
      }
    });
    return Array.from(set);
  }, [machines]);

  // 需求 10：依場地/店點統計損益
  const venueBreakdown = useMemo(() => {
    return uniqueVenues.map((venueName) => {
      const vMachines = machines.filter(
        (m) => (m.location || '').trim() === venueName
      );
      const vMachineIds = new Set(vMachines.map((m) => m.machine_id));

      const vBoards = filteredBoards.filter((b) => vMachineIds.has(b.machine_id));
      const vReadings = filteredReadings.filter((r) => vMachineIds.has(r.machine_id));

      let totalGross = 0;
      let totalCashback = 0;
      let totalPrizeCost = 0;

      vBoards.forEach((b) => {
        const fin = calculateScratchBoardFinancials(b.board_cost, b.gross_coin_revenue, b.prizes);
        totalGross += fin.grossCoinRevenue;
        totalCashback += fin.totalCashbackDeducted;
        totalPrizeCost += fin.claimedPrizeCost;
      });

      vReadings.forEach((r) => {
        if (!r.board_id && r.cash_collected > 0) {
          totalGross += r.cash_collected;
        }
      });

      const rawOverhead = calculateSimpleOverhead(vMachines, filteredExpenses, 'ALL', {
        dateRange,
        currentPeriodMonth: currentPeriodMonthStr,
      });
      const totalOverhead = rawOverhead.grandTotalOverhead;

      const netRevenue = totalGross - totalCashback;
      const netProfit = netRevenue - totalPrizeCost - totalOverhead;

      return {
        venueName,
        machinesCount: vMachines.length,
        totalGross,
        totalCashback,
        totalPrizeCost,
        totalOverhead,
        netRevenue,
        netProfit,
        machines: vMachines,
        boardsCount: vBoards.length,
      };
    });
  }, [uniqueVenues, machines, filteredBoards, filteredReadings, filteredExpenses, dateRange, currentPeriodMonthStr]);

  // 刮板維度篩選清單
  const displayedBoards = useMemo(() => {
    return filteredBoards.filter((b) => {
      const m = machines.find((mc) => mc.machine_id === b.machine_id);
      if (selectedVenueFilter !== 'ALL' && (m?.location || '').trim() !== selectedVenueFilter) {
        return false;
      }
      if (boardStatusFilter !== 'ALL' && b.status !== boardStatusFilter) {
        return false;
      }
      return true;
    });
  }, [filteredBoards, machines, selectedVenueFilter, boardStatusFilter]);

  // 依場地篩選後的機台損益排行（淨利由高到低）
  const scopedMachineBreakdown = useMemo(() => {
    const list =
      selectedVenueFilter === 'ALL'
        ? analytics.machineBreakdown
        : analytics.machineBreakdown.filter(
            (r) => (r.machine.location || '').trim() === selectedVenueFilter
          );
    return [...list].sort((a, b) => b.netProfit - a.netProfit);
  }, [analytics.machineBreakdown, selectedVenueFilter]);

  // 依場地篩選後的總結指標
  const scopedTotals = useMemo(() => {
    if (selectedVenueFilter === 'ALL') {
      return {
        grossRevenue: analytics.totalGrossRevenue,
        cashbackDeducted: analytics.totalCashbackDeducted,
        prizeCost: analytics.totalPrizeCost,
        overhead: analytics.grandTotalOverhead,
        netProfit: analytics.trueNetProfit,
        profitMargin:
          analytics.totalGrossRevenue > 0
            ? Math.round((analytics.trueNetProfit / analytics.totalGrossRevenue) * 1000) / 10
            : 0,
        cashbackPct,
        prizeCostPct,
        rentPct,
        profitPct,
      };
    }

    const grossRevenue = scopedMachineBreakdown.reduce((s, r) => s + r.grossRevenue, 0);
    const cashbackDeducted = scopedMachineBreakdown.reduce((s, r) => s + r.cashbackDeducted, 0);
    const prizeCost = scopedMachineBreakdown.reduce((s, r) => s + r.totalDirectPrizeCost, 0);
    const venueMachines = scopedMachineBreakdown.map((r) => r.machine);
    const venueMachineIds = new Set(venueMachines.map((m) => m.machine_id));
    const venueExpenses = filteredExpenses.filter(
      (e) => e.machine_id && venueMachineIds.has(e.machine_id)
    );
    const overhead = calculateSimpleOverhead(venueMachines, venueExpenses, 'ALL', {
      dateRange,
      currentPeriodMonth: currentPeriodMonthStr,
    }).grandTotalOverhead;
    const netProfit = grossRevenue - cashbackDeducted - prizeCost - overhead;
    const base = Math.max(1, grossRevenue);
    const cbP = Math.min(100, Math.round((cashbackDeducted / base) * 100));
    const prP = Math.min(100, Math.round((prizeCost / base) * 100));
    const rP = Math.min(100, Math.round((overhead / base) * 100));
    const pfP = Math.max(0, 100 - cbP - prP - rP);

    return {
      grossRevenue,
      cashbackDeducted,
      prizeCost,
      overhead,
      netProfit,
      profitMargin:
        grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0,
      cashbackPct: cbP,
      prizeCostPct: prP,
      rentPct: rP,
      profitPct: pfP,
    };
  }, [
    selectedVenueFilter,
    analytics,
    cashbackPct,
    prizeCostPct,
    rentPct,
    profitPct,
    scopedMachineBreakdown,
    filteredExpenses,
    dateRange,
    currentPeriodMonthStr,
  ]);

  return (
    <div className="space-y-4">
      {/* 1. 精簡頂部篩選控制列：時間範圍 + 場地 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-4 bg-[#0B0F17] p-1 rounded-xl border border-slate-800 flex-1 min-w-[200px]">
            {(['ALL', 'WEEK', 'MONTH', 'YEAR'] as PeriodType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPeriodType(type);
                  if (type === 'WEEK') setWeekOffset(0);
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  periodType === type
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'ALL'
                  ? '全部'
                  : type === 'WEEK'
                  ? '本週'
                  : type === 'MONTH'
                  ? '月份'
                  : '年度'}
              </button>
            ))}
          </div>

          {uniqueVenues.length > 1 && (
            <select
              value={selectedVenueFilter}
              onChange={(e) => setSelectedVenueFilter(e.target.value)}
              className="bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">全部場地 ({uniqueVenues.length})</option>
              {uniqueVenues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 週選擇控制 */}
        {periodType === 'WEEK' && dateRange && (
          <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
              <span>
                {dateRange.start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                {' - '}
                {dateRange.end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
              </span>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300"
                >
                  回本週
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              disabled={weekOffset >= 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 月選擇控制 */}
        {periodType === 'MONTH' && (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 年選擇控制 */}
        {periodType === 'YEAR' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>
                {y} 年度
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 2. 置頂核心損益總結卡 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-400">
              {selectedVenueFilter === 'ALL' ? '全場實質淨利' : `[${selectedVenueFilter}] 實質淨利`}
            </div>
            <div
              className={`text-3xl font-mono font-bold tracking-tight mt-0.5 ${
                scopedTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatProfit(scopedTotals.netProfit)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-400">淨利率</div>
            <div className="inline-flex items-center px-2 py-0.5 mt-1 rounded-md bg-[#0B0F17] border border-slate-800 text-xs font-mono font-bold text-amber-400">
              {scopedTotals.profitMargin}%
            </div>
          </div>
        </div>

        {/* 4 色結構佔比條 */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-[#0B0F17] rounded-full overflow-hidden flex border border-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${scopedTotals.profitPct}%` }}
              title={`淨利 ${scopedTotals.profitPct}%`}
            />
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${scopedTotals.rentPct}%` }}
              title={`台租 ${scopedTotals.rentPct}%`}
            />
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${scopedTotals.prizeCostPct}%` }}
              title={`獎品 ${scopedTotals.prizeCostPct}%`}
            />
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${scopedTotals.cashbackPct}%` }}
              title={`回錢 ${scopedTotals.cashbackPct}%`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <span className="text-emerald-400">● 淨利 {scopedTotals.profitPct}%</span>
            <span className="text-amber-400">● 台租 {scopedTotals.rentPct}%</span>
            <span className="text-sky-400">● 獎品 {scopedTotals.prizeCostPct}%</span>
            <span className="text-rose-400">● 回錢 {scopedTotals.cashbackPct}%</span>
          </div>
        </div>

        {/* 4 格重點收支指標 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">總收幣</div>
            <div className="text-base font-mono font-bold text-white">
              ${scopedTotals.grossRevenue.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">實付台租與雜支</div>
            <div className="text-base font-mono font-bold text-amber-400">
              -${scopedTotals.overhead.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">獎品貨本</div>
            <div className="text-base font-mono font-bold text-sky-400">
              -${scopedTotals.prizeCost.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">回錢支出</div>
            <div className="text-base font-mono font-bold text-rose-400">
              -${scopedTotals.cashbackDeducted.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 輕量級「機台錢箱現況」 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsCoinBoxExpanded((prev) => !prev)}
          className="w-full p-3.5 flex items-center justify-between gap-2 text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">機台錢箱現況</div>
              <div className="text-[11px] font-mono text-slate-400 truncate">
                錢箱內 <span className="text-emerald-400 font-bold">${coinBoxSummary.totalInCoinBoxes.toLocaleString()}</span>
                <span className="mx-1.5 text-slate-600">·</span>
                已換幣取出 <span className="text-amber-400 font-bold">${coinBoxSummary.totalWithdrawn.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold shrink-0">
            <span>{isCoinBoxExpanded ? '收合' : '明細'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isCoinBoxExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isCoinBoxExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-800 space-y-3">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                各機台錢箱現有餘額
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {machines.map((m) => (
                  <div
                    key={m.machine_id}
                    className="bg-[#0B0F17] border border-slate-800/80 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-mono text-slate-300 truncate">
                      {m.code} {m.name}
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        (m.coin_box_balance || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      ${(m.coin_box_balance || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                近期錢箱換幣取出紀錄 ({coinBoxSummary.filteredWithdrawals.length} 筆)
              </div>
              {coinBoxSummary.filteredWithdrawals.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 text-center bg-[#0B0F17] rounded-lg border border-slate-800/80">
                  尚無取出紀錄
                </div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {coinBoxSummary.filteredWithdrawals.slice(0, 10).map((w) => {
                    const m = machines.find((mc) => mc.machine_id === w.machine_id);
                    return (
                      <div
                        key={w.withdrawal_id}
                        className="bg-[#0B0F17] border border-slate-800/80 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                              {m ? m.code : '全場'}
                            </span>
                            <span className="font-bold text-slate-200">已取出</span>
                            {w.note && (
                              <span className="text-slate-400 truncate">· {w.note}</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {new Date(w.withdrawn_at).toLocaleString('zh-TW', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-400 shrink-0">
                          ${w.amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. 近 6 個月營運損益走勢 (圖表 + 點選月份明細二合一，預設收合) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsSixMonthTrendExpanded((prev) => !prev)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-white">近 6 個月營運損益走勢</h3>
              <p className="text-[11px] text-slate-400">
                {isSixMonthTrendExpanded
                  ? '點擊柱狀可查看該月收支明細'
                  : '展開查看 6 個月淨利趨勢與月度拆解'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold shrink-0">
            <span>{isSixMonthTrendExpanded ? '收合' : '展開'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isSixMonthTrendExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isSixMonthTrendExpanded && (
          <div className="p-4 pt-3 space-y-3 border-t border-slate-800/80">
            {/* 6 欄柱狀走勢圖 */}
            {(() => {
              const maxPos = Math.max(1, ...monthlyTrends.map((m) => Math.max(0, m.net_profit)));
              const maxNeg = Math.max(0, ...monthlyTrends.map((m) => Math.max(0, -m.net_profit)));
              const hasNegative = maxNeg > 0;
              const posRatio = hasNegative ? maxPos / (maxPos + maxNeg) : 1;
              const trackTotalPx = 96;
              const posHeightPx = hasNegative ? Math.max(12, Math.round(posRatio * trackTotalPx)) : trackTotalPx;
              const negHeightPx = hasNegative ? Math.max(12, trackTotalPx - posHeightPx) : 0;
              // py-1 (4px) + h-4 (16px) + my-0.5 (2px) = 22px 頂部偏移，對齊正負柱狀交界處
              const zeroLineTopPx = 22 + posHeightPx;

              return (
                <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="relative w-full flex items-stretch justify-between gap-1">
                    {hasNegative && (
                      <div
                        className="absolute inset-x-0 border-t border-slate-700/70 border-dashed z-0 pointer-events-none"
                        style={{ top: `${zeroLineTopPx}px` }}
                      >
                        <span className="absolute left-0 -top-2.5 text-[9px] font-mono text-slate-400 bg-[#0B0F17] px-1">
                          $0
                        </span>
                      </div>
                    )}

                    {monthlyTrends.map((trend) => {
                      const isSelected = activeTrendMonth?.period_label === trend.period_label;
                      const isProfit = trend.net_profit >= 0;
                      const barHeightPct = isProfit
                        ? Math.min(100, Math.max(6, Math.round((trend.net_profit / maxPos) * 100)))
                        : Math.min(100, Math.max(6, Math.round((-trend.net_profit / (maxNeg || 1)) * 100)));

                      const profitLabel = isProfit
                        ? `+$${Math.abs(trend.net_profit) >= 1000 ? (trend.net_profit / 1000).toFixed(1) + 'k' : trend.net_profit}`
                        : `-$${Math.abs(trend.net_profit) >= 1000 ? (Math.abs(trend.net_profit) / 1000).toFixed(1) + 'k' : Math.abs(trend.net_profit)}`;

                      return (
                        <div
                          key={trend.period_label}
                          onClick={() => setSelectedTrendMonthKey(trend.period_label)}
                          className={`flex-1 flex flex-col items-center justify-between cursor-pointer group rounded-lg py-1 px-0.5 transition-all z-10 ${
                            isSelected ? 'ring-1 ring-amber-500/60' : 'hover:opacity-90'
                          }`}
                        >
                          <div className="text-[9px] sm:text-[10px] font-mono font-bold whitespace-nowrap h-4 flex items-center">
                            <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                              {trend.gross_coin_revenue === 0 && trend.net_profit === 0 ? '$0' : profitLabel}
                            </span>
                          </div>

                          <div className="w-full flex flex-col justify-center relative my-0.5">
                            <div className="w-full flex flex-col justify-end items-center" style={{ height: `${posHeightPx}px` }}>
                              {isProfit && (
                                <div
                                  className={`w-4 sm:w-6 rounded-t-md transition-all ${
                                    isSelected ? 'bg-emerald-400' : 'bg-emerald-500 group-hover:bg-emerald-400'
                                  }`}
                                  style={{ height: `${barHeightPct}%` }}
                                />
                              )}
                            </div>
                            {hasNegative && (
                              <div className="w-full flex flex-col justify-start items-center" style={{ height: `${negHeightPx}px` }}>
                                {!isProfit && (
                                  <div
                                    className={`w-4 sm:w-6 rounded-b-md transition-all ${
                                      isSelected ? 'bg-rose-400' : 'bg-rose-500 group-hover:bg-rose-400'
                                    }`}
                                    style={{ height: `${barHeightPct}%` }}
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          <div className={`text-[10px] font-mono font-bold ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}>
                            {trend.month_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 點選焦點月份之完整收支明細 */}
            {activeTrendMonth && (
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    {activeTrendMonth.year}年 {activeTrendMonth.month_name} 損益明細
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      activeTrendMonth.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    淨利 {formatProfit(activeTrendMonth.net_profit)} ({activeTrendMonth.net_margin_pct}%)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">純機收幣</span>
                    <span className="text-white font-bold">
                      ${activeTrendMonth.standard_machine_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">刮板收幣</span>
                    <span className="text-amber-400 font-bold">
                      ${activeTrendMonth.scratch_machine_revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">實付台租</span>
                    <span className="text-amber-300 font-bold">
                      -${activeTrendMonth.rent_and_overhead.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">獎品成本</span>
                    <span className="text-sky-400 font-bold">
                      -${activeTrendMonth.product_cost.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">回錢給付</span>
                    <span className="text-rose-400 font-bold">
                      -${activeTrendMonth.cashback_deducted.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400">總收幣合計</span>
                    <span className="text-emerald-400 font-bold">
                      ${activeTrendMonth.gross_coin_revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. 損益排行與明細 (三合一 Segmented Tabs：依機台 | 依場地 | 依刮板) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 bg-[#0B0F17] p-1 rounded-xl border border-slate-800 gap-1">
          {[
            { key: 'MACHINE', label: `依機台 (${scopedMachineBreakdown.length})` },
            { key: 'VENUE', label: `依場地 (${venueBreakdown.length})` },
            { key: 'BOARD', label: `依刮板 (${displayedBoards.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setDetailTab(tab.key as DetailTab)}
              className={`py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                detailTab === tab.key
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 5A. 依機台排行 */}
        {detailTab === 'MACHINE' && (
          <div className="space-y-2.5">
            {scopedMachineBreakdown.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">尚無機台資料</div>
            ) : (
              scopedMachineBreakdown.map((row, idx) => {
                const revBarPct = Math.min(
                  100,
                  Math.round((row.grossRevenue / analytics.maxMachineRevenue) * 100)
                );
                const costTotal =
                  row.cashbackDeducted + row.totalDirectPrizeCost + row.fixedOverhead;
                const costBarPct = Math.min(
                  100,
                  Math.round((costTotal / analytics.maxMachineRevenue) * 100)
                );

                return (
                  <div
                    key={row.machine.machine_id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-slate-500 w-4 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                          {row.machine.code}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {row.machine.name}
                        </span>
                        {row.machine.location && (
                          <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                            · {row.machine.location}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-mono font-bold shrink-0 ${
                          row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(row.netProfit)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="w-8 text-slate-400 shrink-0">收幣</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${revBarPct}%` }} />
                        </div>
                        <span className="w-16 text-right text-amber-300 font-bold shrink-0">
                          ${row.grossRevenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="w-8 text-slate-400 shrink-0">支出</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${costBarPct}%` }} />
                        </div>
                        <span className="w-16 text-right text-rose-400 shrink-0">
                          -${costTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>台租 -${row.fixedOverhead.toLocaleString()}</span>
                      <span>貨本 -${row.totalDirectPrizeCost.toLocaleString()}</span>
                      <span>回錢 -${row.cashbackDeducted.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 5B. 依場地彙總 */}
        {detailTab === 'VENUE' && (
          <div className="space-y-2.5">
            {venueBreakdown.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">尚無場地資料</div>
            ) : (
              venueBreakdown.map((v) => (
                <div
                  key={v.venueName}
                  className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{v.venueName}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({v.machinesCount} 台)
                      </span>
                    </div>
                    <span
                      className={`text-sm font-mono font-bold shrink-0 ${
                        v.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatProfit(v.netProfit)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800/80">
                      <span className="block text-[10px] text-slate-400">總收幣</span>
                      <span className="text-white font-bold">${v.totalGross.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800/80">
                      <span className="block text-[10px] text-slate-400">台租</span>
                      <span className="text-amber-400 font-bold">-${v.totalOverhead.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800/80">
                      <span className="block text-[10px] text-slate-400">貨本</span>
                      <span className="text-sky-400 font-bold">-${v.totalPrizeCost.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800/80">
                      <span className="block text-[10px] text-slate-400">回錢</span>
                      <span className="text-rose-400 font-bold">-${v.totalCashback.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 5C. 依刮板明細 */}
        {detailTab === 'BOARD' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              {[
                { key: 'ALL', label: '全部' },
                { key: 'ACTIVE', label: '進行中' },
                { key: 'SETTLED', label: '已結算' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setBoardStatusFilter(st.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    boardStatusFilter === st.key
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-[#0B0F17] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {displayedBoards.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">無符合條件的刮板</div>
            ) : (
              displayedBoards.map((b) => {
                const m = machines.find((mc) => mc.machine_id === b.machine_id);
                const fin = calculateScratchBoardFinancials(b.board_cost, b.gross_coin_revenue, b.prizes);
                const scratched = b.total_holes - b.remaining_holes;
                return (
                  <div
                    key={b.board_id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 shrink-0">
                          {m?.code || '機台'}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{b.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.status === 'ACTIVE' ? '進行中' : '已結算'}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-mono font-bold shrink-0 ${
                          fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(fin.netProfit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>進度 {scratched}/{b.total_holes} 洞</span>
                      <span>收幣 ${fin.grossCoinRevenue.toLocaleString()}</span>
                      <span>貨本 -${fin.claimedPrizeCost.toLocaleString()}</span>
                      <span>回錢 -${fin.totalCashbackDeducted.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 6. 資料備份與系統維護 (預設收合於頁面最底端) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsMaintenanceExpanded((prev) => !prev)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Download className="w-4 h-4 text-amber-400" />
            <span>資料備份與系統維護</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold">
            <span>{isMaintenanceExpanded ? '收合' : '展開'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isMaintenanceExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isMaintenanceExpanded && (
          <div className="p-4 pt-3 border-t border-slate-800 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const text = event.target?.result as string;
                    const parsed = JSON.parse(text);
                    setImportedDataPreview(parsed);
                  } catch {
                    alert('解析 JSON 備份檔失敗，請確認檔案格式是否正確。');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
              className="hidden"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition-colors"
              >
                <Upload className="w-4 h-4" />
                匯入 JSON
              </button>

              <button
                type="button"
                onClick={onExportJSON}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4 text-amber-400" />
                匯出 JSON
              </button>

              <button
                type="button"
                onClick={onExportCSV}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                匯出 CSV
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                全系統清空歸零
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 匯入備份確認彈窗 (需求 8) */}
      {importedDataPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-sky-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>確認匯入備份資料</span>
              </div>
              <button
                type="button"
                onClick={() => setImportedDataPreview(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              已成功讀取備份檔案，內容摘要如下：
            </p>

            <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">機台資料：</span>
                <span className="text-white font-bold">
                  {Array.isArray(importedDataPreview.machines)
                    ? importedDataPreview.machines.length
                    : 0}{' '}
                  台
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">抄錶／收幣紀錄：</span>
                <span className="text-white font-bold">
                  {Array.isArray(importedDataPreview.readings)
                    ? importedDataPreview.readings.length
                    : 0}{' '}
                  筆
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">刮刮樂看板：</span>
                <span className="text-white font-bold">
                  {Array.isArray(importedDataPreview.scratchBoards)
                    ? importedDataPreview.scratchBoards.length
                    : 0}{' '}
                  個
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">庫存商品項目：</span>
                <span className="text-white font-bold">
                  {Array.isArray(importedDataPreview.inventoryItems)
                    ? importedDataPreview.inventoryItems.length
                    : 0}{' '}
                  項
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">費用開銷記錄：</span>
                <span className="text-white font-bold">
                  {Array.isArray(importedDataPreview.expenses)
                    ? importedDataPreview.expenses.length
                    : 0}{' '}
                  筆
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onImportJSON(importedDataPreview, 'OVERWRITE');
                  setImportedDataPreview(null);
                }}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                完整覆蓋還原（推薦，清空現有資料）
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportJSON(importedDataPreview, 'MERGE');
                  setImportedDataPreview(null);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                智能合併（保留現有資料並匯入）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系統全部初始化歸零確認彈窗 (需求 2) */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111827] border border-rose-500/50 rounded-t-3xl sm:rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="sm:hidden flex justify-center pt-1 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  全系統初始化確認
                </h3>
                <p className="text-xs text-rose-300 mt-0.5">
                  警告：此操作將徹底清空全部資料！
                </p>
              </div>
            </div>

            <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-3.5 space-y-1.5 text-xs text-rose-200">
              <div className="font-bold flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                將清除以下所有本地儲存之資料：
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-300/80">
                <li>所有機台清單與設定</li>
                <li>全部歷史抄錶／收幣與清0記錄</li>
                <li>所有刮刮樂看板及各版獎項開獎進度</li>
                <li>所有倉庫庫存與機台擺設商品</li>
                <li>所有定期租金與雜支開銷紀錄</li>
              </ul>
              <div className="text-[10px] text-amber-300 font-bold pt-1">
                ※ 執行後無法復原！若需留存請先於上方點擊「匯出完整 JSON」。
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetEntireApp();
                  setIsResetConfirmOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm"
              >
                確認清空歸零
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
