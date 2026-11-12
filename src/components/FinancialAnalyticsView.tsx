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
  Filter,
  Package,
} from 'lucide-react';
import {
  Expense,
  FleetFilter,
  InventoryItem,
  Machine,
  MeterReading,
  MonthlyFinancialTrend,
  ScratchBoard,
} from '../types';
import {
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
  activeMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonData: any, mode: 'OVERWRITE' | 'MERGE') => void;
  onResetDemoData: () => void;
  onResetEntireApp: () => void;
}

type PeriodType = 'ALL' | 'WEEK' | 'MONTH' | 'YEAR';
type AnalyticsDimension = 'OVERVIEW' | 'VENUE' | 'MACHINE' | 'BOARD';

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

  // 需求 10：多面向損益維度 (全場總覽、依場地、依機台、依刮板)
  const [analyticsDimension, setAnalyticsDimension] =
    useState<AnalyticsDimension>('OVERVIEW');
  const [selectedVenueFilter, setSelectedVenueFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');
  const [boardStatusFilter, setBoardStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SETTLED'
  >('ALL');

  // 需求 2：近 6 個月損益趨勢與雙棲混營視角篩選狀態
  const [monthlyFleetFilter, setMonthlyFleetFilter] = useState<FleetFilter>('ALL');
  const [selectedTrendMonthKey, setSelectedTrendMonthKey] = useState<string>('');
  const [expandedMonthCards, setExpandedMonthCards] = useState<Record<string, boolean>>({});

  const mappedReadings = useMemo(() => {
    return readings.map((r) => ({
      machine_id: r.machine_id,
      read_at: r.read_at,
      revenue_amount: r.cash_collected || r.panel_amount || 0,
      prize_delta: r.prizes_delta || 0,
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
        fleetFilter: monthlyFleetFilter,
      }
    );
  }, [mappedReadings, machines, expenses, scratchBoards, monthlyFleetFilter]);

  const activeTrendMonth = useMemo(() => {
    if (selectedTrendMonthKey) {
      const match = monthlyTrends.find((m) => m.period_label === selectedTrendMonthKey);
      if (match) return match;
    }
    return monthlyTrends[monthlyTrends.length - 1] || null;
  }, [monthlyTrends, selectedTrendMonthKey]);

  const toggleMonthCardExpanded = (periodLabel: string) => {
    setExpandedMonthCards((prev) => ({
      ...prev,
      [periodLabel]: !prev[periodLabel],
    }));
  };

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
      return (
        (createdT >= dateRange.start.getTime() && createdT <= dateRange.end.getTime()) ||
        (settledT >= dateRange.start.getTime() && settledT <= dateRange.end.getTime())
      );
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

      let boardGrossCoin = 0;
      let boardCashbackDeducted = 0;
      let boardNetCoin = 0;
      let boardPrizeCost = 0;
      let boardPaperCost = 0;

      mBoards.forEach((b) => {
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          b.gross_coin_revenue,
          b.prizes
        );
        boardGrossCoin += fin.grossCoinRevenue;
        boardCashbackDeducted += fin.totalCashbackDeducted;
        boardNetCoin += fin.netCoinRevenue;
        boardPrizeCost += fin.claimedPrizeCost;
        boardPaperCost += Number(b.board_cost) || 0;
      });

      const standaloneReadingsRevenue = mReadings
        .filter((r) => !r.board_id)
        .reduce((sum, r) => sum + (Number(r.cash_collected) || 0), 0);

      const grossRevenue = boardGrossCoin + standaloneReadingsRevenue;
      const netRevenueAfterCashback = boardNetCoin + standaloneReadingsRevenue;
      const totalDirectPrizeCost = boardPrizeCost + boardPaperCost;
      const netProfit =
        netRevenueAfterCashback -
        totalDirectPrizeCost -
        mAdjustedOverhead;

      return {
        machine: m,
        boardsCount: mBoards.length,
        grossRevenue,
        cashbackDeducted: boardCashbackDeducted,
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

  // 需求 10：刮板維度篩選清單
  const displayedBoards = useMemo(() => {
    return filteredBoards.filter((b) => {
      const m = machines.find((mc) => mc.machine_id === b.machine_id);
      if (selectedVenueFilter !== 'ALL' && (m?.location || '').trim() !== selectedVenueFilter) {
        return false;
      }
      if (selectedMachineFilter !== 'ALL' && b.machine_id !== selectedMachineFilter) {
        return false;
      }
      if (boardStatusFilter !== 'ALL' && b.status !== boardStatusFilter) {
        return false;
      }
      return true;
    });
  }, [filteredBoards, machines, selectedVenueFilter, selectedMachineFilter, boardStatusFilter]);

  return (
    <div className="space-y-4">
      {/* 多面向損益維度切換列 (總覽 / 場地 / 機台 / 刮板 - 手機端 2x2 佈局防擠壓) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#111827] p-1.5 rounded-xl border border-[#1E293B] gap-1.5">
        <button
          type="button"
          onClick={() => setAnalyticsDimension('OVERVIEW')}
          className={`flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
            analyticsDimension === 'OVERVIEW'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>總覽</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsDimension('VENUE')}
          className={`flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
            analyticsDimension === 'VENUE'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5 shrink-0" />
          <span>場地</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsDimension('MACHINE')}
          className={`flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
            analyticsDimension === 'MACHINE'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span>機台</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsDimension('BOARD')}
          className={`flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
            analyticsDimension === 'BOARD'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5 shrink-0" />
          <span>刮板</span>
        </button>
      </div>

      {/* 條件篩選列 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-slate-400 font-bold shrink-0">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>篩選</span>
        </div>
        <select
          value={selectedVenueFilter}
          onChange={(e) => setSelectedVenueFilter(e.target.value)}
          className="flex-1 min-w-[100px] bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
        >
          <option value="ALL">全部場地</option>
          {uniqueVenues.map((v) => (
            <option key={v} value={v}>
              📍 {v}
            </option>
          ))}
        </select>

        <select
          value={selectedMachineFilter}
          onChange={(e) => setSelectedMachineFilter(e.target.value)}
          className="flex-1 min-w-[100px] bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
        >
          <option value="ALL">全部機台</option>
          {machines.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              [{m.code}] {m.name}
            </option>
          ))}
        </select>

        {analyticsDimension === 'BOARD' && (
          <select
            value={boardStatusFilter}
            onChange={(e) => setBoardStatusFilter(e.target.value as any)}
            className="flex-1 min-w-[85px] bg-[#0B0F17] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
          >
            <option value="ALL">全部狀態</option>
            <option value="ACTIVE">進行中</option>
            <option value="SETTLED">已結算</option>
          </select>
        )}
      </div>

      {/* 0. 時間區間篩選控制列 (需求 7) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>時間範圍</span>
          </div>

          {/* 週 / 月 / 年 / 全部切換 */}
          <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800">
            {(['ALL', 'WEEK', 'MONTH', 'YEAR'] as PeriodType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPeriodType(type);
                  if (type === 'WEEK') setWeekOffset(0);
                  if (type === 'MONTH') {
                    setSelectedYear(now.getFullYear());
                    setSelectedMonth(now.getMonth() + 1);
                  }
                  if (type === 'YEAR') setSelectedYear(now.getFullYear());
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  periodType === type
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'ALL' && '全部'}
                {type === 'WEEK' && '週'}
                {type === 'MONTH' && '月'}
                {type === 'YEAR' && '年'}
              </button>
            ))}
          </div>
        </div>

        {/* 週選擇控制 */}
        {periodType === 'WEEK' && dateRange && (
          <div className="flex items-center justify-between bg-[#0B0F17] px-3 py-2 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="flex items-center gap-1 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              上一週
            </button>
            <div className="font-mono font-bold text-amber-400 text-center">
              {weekOffset === 0 && (
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded mr-1.5">
                  本週
                </span>
              )}
              {dateRange.start.toLocaleDateString(undefined, {
                month: '2-digit',
                day: '2-digit',
              })}{' '}
              ~{' '}
              {dateRange.end.toLocaleDateString(undefined, {
                month: '2-digit',
                day: '2-digit',
              })}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="flex items-center gap-1 text-slate-400 hover:text-white"
            >
              下一週
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 月選擇控制 */}
        {periodType === 'MONTH' && (
          <div className="flex items-center justify-between gap-2 bg-[#0B0F17] px-3 py-2 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-[#111827] border border-slate-700 rounded-md px-2 py-1 text-xs text-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-[#111827] border border-slate-700 rounded-md px-2 py-1 text-xs text-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedYear(now.getFullYear());
                setSelectedMonth(now.getMonth() + 1);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold"
            >
              切至本月
            </button>
          </div>
        )}

        {/* 年選擇控制 */}
        {periodType === 'YEAR' && (
          <div className="flex items-center justify-between bg-[#0B0F17] px-3 py-2 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">選擇結算年度：</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#111827] border border-slate-700 rounded-md px-3 py-1 text-xs text-white font-mono font-bold"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y} 年度
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 維度 1：全場損益總覽 (OVERVIEW) */}
      {analyticsDimension === 'OVERVIEW' && (
        <>
          {/* 需求 2：近 6 個月損益走勢 (手機圖表化 · 支援全場總帳與雙棲分流) */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">近 6 個月營運損益走勢</h3>
                  <p className="text-[11px] text-slate-400">免橫向滾動圖表 · 點擊柱狀切換焦點月份</p>
                </div>
              </div>

              {/* 3-way 雙棲混營視角切換膠囊 (全場總帳預設合併、可分流純機與刮板) */}
              <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMonthlyFleetFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    monthlyFleetFilter === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  全場合計
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyFleetFilter('STANDARD')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    monthlyFleetFilter === 'STANDARD'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  純娃娃機
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyFleetFilter('SCRATCH_HYBRID')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    monthlyFleetFilter === 'SCRATCH_HYBRID'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  刮板台
                </button>
              </div>
            </div>

            {/* 6 欄縱向長條柱狀走勢圖 */}
            {(() => {
              const maxPos = Math.max(1, ...monthlyTrends.map((m) => Math.max(0, m.net_profit)));
              const maxNeg = Math.max(0, ...monthlyTrends.map((m) => Math.max(0, -m.net_profit)));
              const hasNegative = maxNeg > 0;
              const posRatio = hasNegative ? maxPos / (maxPos + maxNeg) : 1;
              const chartHeightPx = 140;
              const zeroLineTopPx = Math.round(chartHeightPx * posRatio);

              return (
                <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="relative h-[140px] w-full flex items-stretch justify-between gap-1">
                    {/* 0 軸水平基準虛線 */}
                    {hasNegative && (
                      <div
                        className="absolute inset-x-0 border-t border-slate-700/60 border-dashed z-0 pointer-events-none"
                        style={{ top: `${zeroLineTopPx}px` }}
                      >
                        <span className="absolute left-1 -top-2.5 text-[9px] font-mono text-slate-400 bg-[#0B0F17] px-1">
                          $0
                        </span>
                      </div>
                    )}

                    {monthlyTrends.map((trend) => {
                      const isSelected = (activeTrendMonth?.period_label === trend.period_label);
                      const isProfit = trend.net_profit >= 0;
                      // 計算柱子高度
                      let barHeightPct = 0;
                      if (isProfit) {
                        barHeightPct = Math.min(100, Math.max(6, Math.round((trend.net_profit / maxPos) * 100)));
                      } else {
                        barHeightPct = Math.min(100, Math.max(6, Math.round((-trend.net_profit / (maxNeg || 1)) * 100)));
                      }

                      const profitLabel = isProfit
                        ? `+$${Math.abs(trend.net_profit) >= 1000 ? (trend.net_profit / 1000).toFixed(1) + 'k' : trend.net_profit}`
                        : `-$${Math.abs(trend.net_profit) >= 1000 ? (Math.abs(trend.net_profit) / 1000).toFixed(1) + 'k' : Math.abs(trend.net_profit)}`;

                      return (
                        <div
                          key={trend.period_label}
                          onClick={() => setSelectedTrendMonthKey(trend.period_label)}
                          className={`relative flex-1 flex flex-col justify-end items-center cursor-pointer select-none rounded-lg p-1 transition-all group ${
                            isSelected
                              ? 'bg-amber-500/10 ring-1 ring-amber-400/60'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* 柱頂金額標籤 */}
                          <div
                            className={`text-[10px] font-mono font-bold leading-none mb-1 text-center whitespace-nowrap ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {profitLabel}
                          </div>

                          {/* 柱狀體軌道 */}
                          <div className="relative w-full flex-1 flex items-stretch">
                            {hasNegative ? (
                              <div className="w-full h-full flex flex-col">
                                {/* 正向區域 */}
                                <div className="flex-1 flex flex-col justify-end items-center">
                                  {isProfit && (
                                    <div
                                      className={`w-full max-w-[28px] bg-emerald-500 rounded-t transition-all ${
                                        isSelected ? 'brightness-125 shadow-sm shadow-emerald-500/30' : 'opacity-85'
                                      }`}
                                      style={{ height: `${barHeightPct}%` }}
                                    />
                                  )}
                                </div>
                                {/* 負向區域 */}
                                <div className="flex-1 flex flex-col justify-start items-center">
                                  {!isProfit && (
                                    <div
                                      className={`w-full max-w-[28px] bg-rose-500 rounded-b transition-all ${
                                        isSelected ? 'brightness-125 shadow-sm shadow-rose-500/30' : 'opacity-85'
                                      }`}
                                      style={{ height: `${barHeightPct}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* 全正數狀態簡化高度 */
                              <div className="w-full h-full flex flex-col justify-end items-center">
                                <div
                                  className={`w-full max-w-[28px] bg-emerald-500 rounded-t transition-all ${
                                    isSelected ? 'brightness-125 shadow-sm shadow-emerald-500/30' : 'opacity-85'
                                  }`}
                                  style={{ height: `${barHeightPct}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* 月份標籤 */}
                          <div
                            className={`text-[10px] font-mono mt-1 text-center whitespace-nowrap ${
                              isSelected
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          >
                            {trend.month_name.replace(' (本月)', '')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1 text-emerald-400">
                      ● 翠綠為獲利月份
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      ● 石榴紅為虧損月份
                    </span>
                    <span className="text-amber-400 font-bold">
                      當前焦點：{activeTrendMonth?.month_name}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 選定月份營收流向 4 色光條 (Selected Month Stream Bar) */}
            {activeTrendMonth && (() => {
              const gross = Math.max(1, activeTrendMonth.gross_coin_revenue);
              const rentP = Math.min(100, Math.round((activeTrendMonth.rent_and_overhead / gross) * 100));
              const prizeP = Math.min(100, Math.round((activeTrendMonth.product_cost / gross) * 100));
              const cashbackP = Math.min(100, Math.round((activeTrendMonth.cashback_deducted / gross) * 100));
              const profitP = Math.max(0, 100 - rentP - prizeP - cashbackP);

              return (
                <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>[{activeTrendMonth.month_name}] 營收流向結構</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        (總收幣 ${activeTrendMonth.gross_coin_revenue.toLocaleString()})
                      </span>
                    </div>
                    <div
                      className={`text-xs font-mono font-bold ${
                        activeTrendMonth.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      淨利 {formatProfit(activeTrendMonth.net_profit)} ({activeTrendMonth.net_margin_pct}%)
                    </div>
                  </div>

                  {/* 4 色比例分段光條 */}
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                    {profitP > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${profitP}%` }}
                        title={`淨利 ${profitP}%`}
                      />
                    )}
                    {rentP > 0 && (
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${rentP}%` }}
                        title={`台租 ${rentP}%`}
                      />
                    )}
                    {prizeP > 0 && (
                      <div
                        className="h-full bg-sky-500 transition-all"
                        style={{ width: `${prizeP}%` }}
                        title={`商品成本 ${prizeP}%`}
                      />
                    )}
                    {cashbackP > 0 && (
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${cashbackP}%` }}
                        title={`回錢 ${cashbackP}%`}
                      />
                    )}
                  </div>

                  {/* 4 項指標數據 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">實質淨利</div>
                      <div className={`font-mono font-bold ${activeTrendMonth.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatProfit(activeTrendMonth.net_profit)}
                      </div>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">實付台租</div>
                      <div className="font-mono font-bold text-amber-400">
                        -${activeTrendMonth.rent_and_overhead.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">商品成本</div>
                      <div className="font-mono font-bold text-sky-400">
                        -${activeTrendMonth.product_cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">回錢給付</div>
                      <div className="font-mono font-bold text-rose-400">
                        -${activeTrendMonth.cashback_deducted.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 手風琴月度體質卡片清單 (取代生硬 8 欄大表格，手機大拇指好點閱) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">
                月度體質明細卡 (點擊展開明細)
              </div>
              <div className="space-y-1.5">
                {[...monthlyTrends].reverse().map((m) => {
                  const isExpanded = !!expandedMonthCards[m.period_label];
                  const isSelected = activeTrendMonth?.period_label === m.period_label;
                  return (
                    <div
                      key={m.period_label}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isSelected
                          ? 'bg-[#0B0F17] border-amber-500/40 shadow-sm'
                          : 'bg-[#0B0F17] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrendMonthKey(m.period_label);
                          toggleMonthCardExpanded(m.period_label);
                        }}
                        className="w-full flex items-center justify-between p-3 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m.month_name}
                          </span>
                          <span className="text-xs text-slate-300 font-mono">
                            收 ${m.gross_coin_revenue.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-mono font-bold ${
                              m.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatProfit(m.net_profit)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({m.net_margin_pct}%)
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">🧸 純機收幣</span>
                            <span className="text-white font-bold">${m.standard_machine_revenue.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">🎟️ 刮板收幣</span>
                            <span className="text-amber-400 font-bold">${m.scratch_machine_revenue.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">🏢 實付台租</span>
                            <span className="text-amber-400 font-bold">-${m.rent_and_overhead.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">📦 獎品成本</span>
                            <span className="text-sky-400 font-bold">-${m.product_cost.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">💸 回錢給付</span>
                            <span className="text-rose-400 font-bold">-${m.cashback_deducted.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111827] border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">🎯 累計出貨</span>
                            <span className="text-emerald-400 font-bold">{m.payout_count} 件 {m.avg_coin_per_prize ? `(均投 $${m.avg_coin_per_prize})` : ''}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 1. 核心總損益與營收結構量表 (Gauge & Stacked Chart) */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">全場損益</span>
              </div>
              <div
                className={`text-lg font-mono font-bold ${
                  analytics.trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                淨利 {formatProfit(analytics.trueNetProfit)}
              </div>
            </div>

            {/* 4 色結構量表 */}
            <div className="space-y-1.5">
              <div className="w-full h-3.5 bg-[#0B0F17] rounded-full overflow-hidden flex border border-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${profitPct}%` }}
                  title="淨利"
                />
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${rentPct}%` }}
                  title="台租費用"
                />
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${prizeCostPct}%` }}
                  title="獎品成本"
                />
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${cashbackPct}%` }}
                  title="回錢扣減"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  ● 淨利 {profitPct}%
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  ● 台租 {rentPct}%
                </span>
                <span className="flex items-center gap-1 text-sky-400">
                  ● 獎品 {prizeCostPct}%
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  ● 回錢 {cashbackPct}%
                </span>
              </div>
            </div>

            {/* 4 格重點指標 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">總收幣</div>
                <div className="text-base font-mono font-bold text-white">
                  ${analytics.totalGrossRevenue.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">回錢扣減</div>
                <div className="text-base font-mono font-bold text-rose-400">
                  -${analytics.totalCashbackDeducted.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">獎品成本</div>
                <div className="text-base font-mono font-bold text-sky-400">
                  -${analytics.totalPrizeCost.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800">
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">台租開銷</div>
                <div className="text-base font-mono font-bold text-amber-400">
                  -${(analytics.grandTotalOverhead ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 各機台損益圖表與卡片 */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                機台排行
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onExportCSV}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200 flex items-center gap-1 whitespace-nowrap"
                >
                  <Download className="w-3 h-3 text-amber-400" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={onExportJSON}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200 flex items-center gap-1 whitespace-nowrap"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  備份
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {analytics.machineBreakdown.map((row) => {
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
                    className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                          {row.machine.code}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {row.machine.name}
                        </span>
                      </div>

                      <div
                        className={`text-sm font-mono font-bold shrink-0 ${
                          row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(row.netProfit)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-8 shrink-0">收幣</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${revBarPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-8 shrink-0">支出</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${costBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">收幣</div>
                        <div className="text-xs font-mono font-bold text-white">
                          ${row.grossRevenue.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">回錢</div>
                        <div className="text-xs font-mono font-bold text-rose-400">
                          -${row.cashbackDeducted.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">獎品</div>
                        <div className="text-xs font-mono font-bold text-sky-400">
                          -${row.totalDirectPrizeCost.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">實付台租</div>
                        <div className="text-xs font-mono font-bold text-amber-400">
                          {row.paidRent > 0 ? `-$${row.paidRent.toLocaleString()}` : '$0'}
                        </div>
                        {row.paidRent === 0 && row.configuredMonthlyRent > 0 && (
                          <div className="text-[11px] text-slate-400 font-mono">待繳 ${row.configuredMonthlyRent.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 各版刮刮樂結算小卡 */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Grid className="w-4 h-4 text-amber-400" />
              各版刮刮樂損益 ({scratchBoards.length} 版)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scratchBoards.map((board) => {
                const m = machines.find((mc) => mc.machine_id === board.machine_id);
                const fin = calculateScratchBoardFinancials(
                  board.board_cost,
                  board.gross_coin_revenue,
                  board.prizes
                );
                const holePct = Math.round(
                  ((board.total_holes - board.remaining_holes) /
                    Math.max(1, board.total_holes)) *
                    100
                );

                return (
                  <div
                    key={board.board_id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-amber-400 shrink-0">
                          [{m?.code}]
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {board.total_holes}刮 (剩{board.remaining_holes}洞)
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold shrink-0 ${
                          fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(fin.netProfit)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${holePct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>收幣 ${fin.grossCoinRevenue.toLocaleString()}</span>
                      <span>回錢 -${fin.totalCashbackDeducted.toLocaleString()}</span>
                      <span>實收 ${fin.netCoinRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 維度 2：依場地店點損益 (VENUE) */}
      {analyticsDimension === 'VENUE' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building className="w-4 h-4 text-amber-400" />
              <span>場地損益 ({venueBreakdown.length})</span>
            </span>
          </div>

          {venueBreakdown.length === 0 ? (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
              尚無場地數據
            </div>
          ) : (
            venueBreakdown
              .filter((v) => selectedVenueFilter === 'ALL' || v.venueName === selectedVenueFilter)
              .map((v) => (
                <div
                  key={v.venueName}
                  className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm">
                        📍
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">{v.venueName}</h3>
                        <div className="text-[11px] font-mono text-slate-400">
                          {v.machinesCount} 台機台 · {v.boardsCount} 版刮板
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-base font-mono font-bold ${
                          v.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(v.netProfit)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        場地淨利 (利潤率 {v.totalGross > 0 ? Math.round((v.netProfit / v.totalGross) * 100) : 0}%)
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
                    <div>
                      <div className="text-xs text-slate-400 font-medium whitespace-nowrap">總投幣</div>
                      <div className="text-xs font-mono font-bold text-white">
                        ${v.totalGross.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium whitespace-nowrap">回錢</div>
                      <div className="text-xs font-mono font-bold text-rose-400">
                        -${v.totalCashback.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium whitespace-nowrap">獎品成本</div>
                      <div className="text-xs font-mono font-bold text-sky-400">
                        -${v.totalPrizeCost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium whitespace-nowrap">場租雜支</div>
                      <div className="text-xs font-mono font-bold text-amber-400">
                        -${v.totalOverhead.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    {v.machines.map((mc) => (
                      <span
                        key={mc.machine_id}
                        className="px-2 py-0.5 rounded bg-[#0B0F17] border border-slate-800 text-[10px] font-mono text-slate-400"
                      >
                        [{mc.code}] {mc.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* 維度 3：個別機台損益 (MACHINE) */}
      {analyticsDimension === 'MACHINE' && (
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              機台損益
            </div>
          </div>

          <div className="space-y-3">
            {analytics.machineBreakdown
              .filter((row) => {
                if (selectedVenueFilter !== 'ALL' && (row.machine.location || '').trim() !== selectedVenueFilter) {
                  return false;
                }
                if (selectedMachineFilter !== 'ALL' && row.machine.machine_id !== selectedMachineFilter) {
                  return false;
                }
                return true;
              })
              .map((row) => {
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
                    className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                          {row.machine.code}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-white block truncate">
                            {row.machine.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            📍 {row.machine.location || '未分類'} · 月租 ${row.configuredMonthlyRent.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`text-sm font-mono font-bold shrink-0 ${
                          row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(row.netProfit)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-8 shrink-0">收幣</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${revBarPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-8 shrink-0">支出</span>
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${costBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">收幣</div>
                        <div className="text-xs font-mono font-bold text-white">
                          ${row.grossRevenue.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">回錢</div>
                        <div className="text-xs font-mono font-bold text-rose-400">
                          -${row.cashbackDeducted.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">獎品</div>
                        <div className="text-xs font-mono font-bold text-sky-400">
                          -${row.totalDirectPrizeCost.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">實付台租</div>
                        <div className="text-xs font-mono font-bold text-amber-400">
                          {row.paidRent > 0 ? `-$${row.paidRent.toLocaleString()}` : '$0'}
                        </div>
                        {row.paidRent === 0 && row.configuredMonthlyRent > 0 && (
                          <div className="text-[11px] text-slate-400 font-mono">待繳 ${row.configuredMonthlyRent.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 維度 4：刮板明細損益 (BOARD) */}
      {analyticsDimension === 'BOARD' && (
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Grid className="w-4 h-4 text-amber-400" />
              <span>刮板明細 ({displayedBoards.length} 版)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayedBoards.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-500">
                符合篩選條件的刮板為 0 版
              </div>
            ) : (
              displayedBoards.map((board) => {
                const m = machines.find((mc) => mc.machine_id === board.machine_id);
                const fin = calculateScratchBoardFinancials(
                  board.board_cost,
                  board.gross_coin_revenue,
                  board.prizes
                );
                const remHoles =
                  board.settled_remaining_holes !== undefined
                    ? board.settled_remaining_holes
                    : board.remaining_holes;
                const scratchedCount =
                  board.settled_scratched_holes !== undefined
                    ? board.settled_scratched_holes
                    : Math.max(0, board.total_holes - remHoles);
                const avgPerHole =
                  board.avg_revenue_per_hole !== undefined
                    ? board.avg_revenue_per_hole
                    : (scratchedCount > 0 ? Math.round(fin.grossCoinRevenue / scratchedCount) : 0);
                const holePct = Math.round(
                  (scratchedCount / Math.max(1, board.total_holes)) * 100
                );

                return (
                  <div
                    key={board.board_id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                          [{m?.code}] {board.board_letter || 'A'}板
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {board.total_holes}刮 (刮{scratchedCount}/剩{remHoles}洞)
                        </span>
                        <span
                          className={`text-[9px] px-1 rounded font-bold shrink-0 ${
                            board.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {board.status === 'ACTIVE' ? '進行中' : '已結算'}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold shrink-0 ${
                          fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatProfit(fin.netProfit)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${holePct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-center pt-2 border-t border-slate-800/80">
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">毛收幣</div>
                        <div className="font-bold text-white">${fin.grossCoinRevenue.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">回錢</div>
                        <div className="font-bold text-rose-400">-${fin.totalCashbackDeducted.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">獎品成本</div>
                        <div className="font-bold text-sky-400">-${fin.claimedPrizeCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">每洞均投</div>
                        <div className="font-bold text-amber-400">${avgPerHole}/洞</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. 資料備份、匯入與系統初始化 (需求 2 & 8) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Download className="w-4 h-4 text-amber-400" />
          資料備份、匯入與系統維護
        </div>

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
          {/* 匯入備份 (需求 8) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition-colors"
          >
            <Upload className="w-4 h-4" />
            匯入 JSON
          </button>

          {/* 匯出備份 */}
          <button
            type="button"
            onClick={onExportJSON}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-amber-400" />
            匯出 JSON
          </button>

          {/* 匯出 CSV */}
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
          {/* 全系統初始化清空 (需求 2) */}
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
