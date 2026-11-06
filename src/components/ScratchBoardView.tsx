import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Plus,
  Coins,
  History,
  Trash2,
  Flag,
  Sparkles,
  Flame,
  AlertTriangle,
  Grid,
  Calendar,
  Package,
} from 'lucide-react';
import {
  InventoryItem,
  Machine,
  ScratchBoard,
  SettleBoardPayload,
} from '../types';
import {
  calculateScratchBoardFinancials,
  computeNumberLuckMatrix,
} from '../utils/calculations';
import { SettleBoardModal } from './SettleBoardModal';

interface ScratchBoardViewProps {
  boards: ScratchBoard[];
  machines: Machine[];
  inventoryItems?: InventoryItem[];
  onQuickMountBoard: (machineId: string, totalHoles: number) => void;
  onAddPrizeToBoard: (
    boardId: string,
    prize: {
      numberLabel: number;
      prizeName?: string;
      isCashback: boolean;
      cashbackAmount: number;
      prizeCost: number;
      syncToInventory?: boolean;
      inventoryItemId?: string;
    }
  ) => void;
  onTogglePrizeClaimed: (
    boardId: string,
    itemId: string,
    claimType?: 'PHYSICAL' | 'CASHBACK'
  ) => void;
  onDeletePrizeFromBoard: (boardId: string, itemId: string) => void;
  onRecordBatchProgress: (payload: {
    boardId: string;
    remainingHoles: number;
    addedCashRevenue: number;
    newlyClaimedNumbers: number[];
    note: string;
  }) => void;
  onUpdateGrossRevenue: (boardId: string, newGrossRevenue: number) => void;
  onSettleBoard: (payload: SettleBoardPayload | string) => void;
  targetBoardId?: string | null;
  onTargetBoardConsumed?: () => void;
}

const HOLE_PRESETS = [40, 60, 80, 100, 120, 160, 200];

export const ScratchBoardView: React.FC<ScratchBoardViewProps> = ({
  boards,
  machines,
  inventoryItems = [],
  onQuickMountBoard,
  onAddPrizeToBoard,
  onTogglePrizeClaimed,
  onDeletePrizeFromBoard,
  onRecordBatchProgress,
  onUpdateGrossRevenue,
  onSettleBoard,
  targetBoardId,
  onTargetBoardConsumed,
}) => {
  // 分頁切換：進行中刮板 vs 刮板紀錄與統計 (需求 5)
  const [mainTab, setMainTab] = useState<'active' | 'stats'>('active');
  const [statsViewMode, setStatsViewMode] = useState<'history' | 'luck'>('history');

  // 統一整合式下版結清彈窗狀態 (避免二次操作與重複計帳)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // 1. 僅篩選出「進行中」刮板，按英文字母順序排列 (需求 5)
  const activeBoards = useMemo(
    () =>
      boards
        .filter((b) => b.status === 'ACTIVE')
        .sort((a, b) =>
          (a.board_letter || 'A').localeCompare(b.board_letter || 'A')
        ),
    [boards]
  );

  // 2. 僅篩選出「已下版結算」刮板，依下版時間新到舊排序
  const settledBoards = useMemo(
    () =>
      boards
        .filter((b) => b.status === 'SETTLED')
        .sort(
          (a, b) =>
            new Date(b.settled_at || 0).getTime() -
            new Date(a.settled_at || 0).getTime()
        ),
    [boards]
  );

  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    targetBoardId || activeBoards[0]?.board_id || ''
  );

  useEffect(() => {
    if (targetBoardId && boards.some((b) => b.board_id === targetBoardId)) {
      setSelectedBoardId(targetBoardId);
      onTargetBoardConsumed?.();
    }
  }, [targetBoardId, boards, onTargetBoardConsumed]);

  // 選取的刮板：若目前選取的板已被下版，自動指派第一個進行中的刮板
  const selectedBoard = useMemo(() => {
    return (
      activeBoards.find((b) => b.board_id === selectedBoardId) ||
      activeBoards[0] ||
      null
    );
  }, [activeBoards, selectedBoardId]);

  const [mountMachineId, setMountMachineId] = useState<string>(
    machines[0]?.machine_id || ''
  );
  const [mountHoles, setMountHoles] = useState<number>(80);

  // 新增獎項表單狀態
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [prizeNumberInput, setPrizeNumberInput] = useState<string>('');
  const [prizeNameInput, setPrizeNameInput] = useState<string>('');
  const [isCashbackInput, setIsCashbackInput] = useState<boolean>(false);
  const [cashbackAmountInput, setCashbackAmountInput] = useState<string>('');
  const [prizeCostInput, setPrizeCostInput] = useState<string>('');
  const [syncToMachineInventory, setSyncToMachineInventory] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. 統計所有進行中刮板已經佔用的倉庫庫存 ID (防呆防重覆選取)
  const activeAssignedInvIds = useMemo(() => {
    const ids = new Set<string>();
    boards
      .filter((b) => b.status === 'ACTIVE')
      .forEach((b) => {
        b.prizes.forEach((p) => {
          if (p.inventory_item_id) ids.add(p.inventory_item_id);
        });
      });
    return ids;
  }, [boards]);

  // 2. 僅篩選出真正屬於倉庫備品 (IN_STOCK)、數量 > 0、且尚未被目前台上刮板選走的可用獎項
  const availableWarehouseItems = useMemo(() => {
    return inventoryItems.filter(
      (it) =>
        it.placement === 'IN_STOCK' &&
        it.quantity > 0 &&
        !activeAssignedInvIds.has(it.item_id)
    );
  }, [inventoryItems, activeAssignedInvIds]);

  // 開獎兌領二擇一彈窗狀態 (拿獎 vs 回錢，需求 8)
  const [choiceModalPrize, setChoiceModalPrize] = useState<{
    item_id: string;
    number_label: number;
    prize_name?: string;
    prize_cost: number;
    cashback_amount: number;
  } | null>(null);

  // 分批巡場紀錄表單狀態
  const [batchRemainingHoles, setBatchRemainingHoles] = useState<number>(
    selectedBoard ? selectedBoard.remaining_holes : 60
  );
  const [batchSelectedNumbers, setBatchSelectedNumbers] = useState<number[]>([]);
  const [batchAddedCash, setBatchAddedCash] = useState<number>(0);

  const handleSelectBoard = (b: ScratchBoard) => {
    setSelectedBoardId(b.board_id);
    setBatchRemainingHoles(b.remaining_holes);
    setBatchSelectedNumbers([]);
    setBatchAddedCash(0);
    setFormError(null);
  };

  const boardFinancials = useMemo(() => {
    if (!selectedBoard) {
      return {
        grossCoinRevenue: 0,
        totalCashbackDeducted: 0,
        netCoinRevenue: 0,
        claimedPrizeCost: 0,
        netProfit: 0,
        claimedCount: 0,
      };
    }
    return calculateScratchBoardFinancials(
      selectedBoard.board_cost,
      selectedBoard.gross_coin_revenue,
      selectedBoard.prizes
    );
  }, [selectedBoard]);

  const luckStats = useMemo(() => computeNumberLuckMatrix(boards), [boards]);

  // 新增獎項送出處理
  const handleAddPrizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard) return;
    setFormError(null);

    const num = Number(prizeNumberInput);
    if (!prizeNumberInput.trim() || isNaN(num) || num < 1) {
      setFormError('請填寫獎號 (正整數)');
      return;
    }

    if (selectedBoard.prizes.some((p) => p.number_label === num)) {
      setFormError(`#${num} 號已在獎項清單中`);
      return;
    }

    const cbAmount = Number(cashbackAmountInput);
    if (
      isCashbackInput &&
      (!cashbackAmountInput.trim() || isNaN(cbAmount) || cbAmount <= 0)
    ) {
      setFormError('請填寫回錢金額');
      return;
    }

    onAddPrizeToBoard(selectedBoard.board_id, {
      numberLabel: num,
      prizeName: prizeNameInput.trim() || undefined,
      isCashback: isCashbackInput,
      cashbackAmount: isCashbackInput ? cbAmount : 0,
      prizeCost: Number(prizeCostInput) || 0,
      syncToInventory: syncToMachineInventory,
      inventoryItemId: selectedInventoryId || undefined,
    });

    setPrizeNumberInput('');
    setPrizeNameInput('');
    setCashbackAmountInput('');
    setPrizeCostInput('');
    setSelectedInventoryId('');
    setSyncToMachineInventory(false);
  };

  const toggleBatchSelectNumber = (num: number) => {
    setBatchSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard) return;

    onRecordBatchProgress({
      boardId: selectedBoard.board_id,
      remainingHoles: Math.max(0, Number(batchRemainingHoles)),
      addedCashRevenue: Math.max(0, Number(batchAddedCash)),
      newlyClaimedNumbers: batchSelectedNumbers,
      note: '分批巡場記錄',
    });

    setBatchSelectedNumbers([]);
    setBatchAddedCash(0);
  };

  const scratchedHoles = selectedBoard
    ? selectedBoard.total_holes - selectedBoard.remaining_holes
    : 0;
  const scratchedPct = selectedBoard
    ? Math.round((scratchedHoles / Math.max(1, selectedBoard.total_holes)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* 頂部主分頁切換：進行中刮板 vs 刮板紀錄與統計 (需求 5：明確分開兩者) */}
      <div className="flex items-center bg-[#111827] p-1 rounded-xl border border-[#1E293B]">
        <button
          type="button"
          onClick={() => setMainTab('active')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            mainTab === 'active'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          進行中刮板 ({activeBoards.length})
        </button>

        <button
          type="button"
          onClick={() => setMainTab('stats')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            mainTab === 'stats'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          刮板紀錄與統計 ({settledBoards.length} 版結算)
        </button>
      </div>

      {mainTab === 'active' ? (
        <div className="space-y-4">
          {/* 快速上版操作列 */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <select
                value={mountMachineId}
                onChange={(e) => setMountMachineId(e.target.value)}
                className="bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
              >
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    [{m.code}] {m.name}
                  </option>
                ))}
              </select>

              <select
                value={mountHoles}
                onChange={(e) => setMountHoles(Number(e.target.value))}
                className="bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-400"
              >
                {HOLE_PRESETS.map((h) => (
                  <option key={h} value={h}>
                    {h} 刮
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onQuickMountBoard(mountMachineId, mountHoles)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              一鍵上版
            </button>
          </div>

          {/* 進行中刮板橫向切換列 (僅顯示台上 ACTIVE 板，依英文字母順序排列，需求 5) */}
          {activeBoards.length === 0 ? (
            <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-6 text-center space-y-2">
              <Grid className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-white text-xs font-bold">目前無任何機台上架刮板</div>
              <p className="text-slate-400 text-[11px]">
                請使用上方「一鍵上版」按鈕，為機台掛上新刮板（將自動從 A板 開始編號）。
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {activeBoards.map((b) => {
                const isSelected = selectedBoard?.board_id === b.board_id;
                const m = machines.find((mc) => mc.machine_id === b.machine_id);
                return (
                  <button
                    key={b.board_id}
                    type="button"
                    onClick={() => handleSelectBoard(b)}
                    className={`shrink-0 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-[#111827] border-[#1E293B] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                      <span className="font-mono text-amber-400">[{m?.code}]</span>
                      <span className="text-white font-black">
                        {b.board_letter || 'A'}板 ({b.total_holes}刮)
                      </span>
                      <span className="text-[10px] text-emerald-400">● 進行中</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 mt-1 whitespace-nowrap">
                      <span>
                        剩 {b.remaining_holes} 洞 · 獎{' '}
                        {b.prizes.filter((p) => p.is_claimed).length}/{b.prizes.length}
                      </span>
                      <span className="text-slate-500">
                        {new Date(b.created_at).toLocaleDateString([], {
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedBoard && (
            <>
              {/* 本版核心損益卡片 */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono font-black text-xs">
                        {selectedBoard.board_letter || 'A'}板
                      </span>
                      <span className="text-sm font-bold text-white truncate">
                        {selectedBoard.title}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      上版時間：
                      {new Date(selectedBoard.created_at).toLocaleString('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · 已刮 {scratchedHoles} / {selectedBoard.total_holes} 洞 ({scratchedPct}%)
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 whitespace-nowrap shrink-0 shadow-lg shadow-emerald-950/30"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    結算下版
                  </button>
                </div>

                {/* 視覺化刮數進度條 */}
                <div className="w-full h-2.5 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, scratchedPct))}%` }}
                  />
                </div>

                {/* 4 格關鍵損益數字 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">面板收幣</div>
                    <div className="text-base font-mono font-bold text-white">
                      ${boardFinancials.grossCoinRevenue.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">回錢自動扣幣</div>
                    <div className="text-base font-mono font-bold text-amber-400">
                      -${boardFinancials.totalCashbackDeducted.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">實質幣量</div>
                    <div className="text-base font-mono font-bold text-white">
                      ${boardFinancials.netCoinRevenue.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#0B0F17] rounded-lg p-2.5 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400">本版賺賠</div>
                    <div
                      className={`text-base font-mono font-bold ${
                        boardFinancials.netProfit >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {boardFinancials.netProfit >= 0 ? '+' : ''}$
                      {boardFinancials.netProfit.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* 分批紀錄：剩幾洞 & 哪幾號出了 */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>分批巡場紀錄（更新剩餘洞數 ＆ 開出獎號）</span>
                  <span className="font-mono text-amber-400">
                    目前剩 {selectedBoard.remaining_holes} 洞
                  </span>
                </div>

                <form onSubmit={handleBatchSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] text-slate-400 mb-1">
                        當前剩下幾洞
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={selectedBoard.total_holes}
                        value={batchRemainingHoles === 0 ? '' : batchRemainingHoles}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                          e.target.select();
                        }}
                        onChange={(e) =>
                          setBatchRemainingHoles(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        placeholder="0"
                        className="w-full bg-transparent text-xl font-mono font-black text-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] text-slate-400 mb-1">
                        順便記收幣 (選填)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={batchAddedCash === 0 ? '' : batchAddedCash}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                          e.target.select();
                        }}
                        onChange={(e) =>
                          setBatchAddedCash(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        placeholder="0"
                        className="w-full bg-transparent text-xl font-mono font-black text-white focus:outline-none"
                      />
                      <span className="block text-[9px] text-slate-500 mt-1 leading-tight">
                        💡 巡場有收幣可在此累加；若習慣整版下版才一次清0，此處留空即可，下版時系統會一次結算。
                      </span>
                    </div>
                  </div>

                  {/* 點選本次開出的獎號 */}
                  {selectedBoard.prizes.filter((p) => !p.is_claimed).length > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1.5">
                        點選本次開出的獎號：
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBoard.prizes
                          .filter((p) => !p.is_claimed)
                          .map((p) => {
                            const isPicked = batchSelectedNumbers.includes(
                              p.number_label
                            );
                            return (
                              <button
                                key={p.item_id}
                                type="button"
                                onClick={() =>
                                  toggleBatchSelectNumber(p.number_label)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                                  isPicked
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                                    : 'bg-[#0B0F17] text-slate-200 border-slate-800'
                                }`}
                              >
                                #{p.number_label}{' '}
                                {p.prize_name ? `(${p.prize_name})` : ''}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors shadow-lg shadow-amber-950/20"
                  >
                    儲存分批紀錄
                  </button>
                </form>
              </div>

              {/* 獎項管理區塊 (貼入獎號 / 獎項清單) */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>本版獎項清單 ({selectedBoard.prizes.length} 個獎)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    點號碼可切換「已出 / 未出」
                  </span>
                </div>

                {/* 新增獎項表單 (支援從倉庫庫存帶入 - 需求 4) */}
                <form
                  onSubmit={handleAddPrizeSubmit}
                  className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3"
                >
                  {/* 倉庫庫存品快速代入 (選填，選中上板後選項立即排除不重覆) */}
                  {inventoryItems.some((it) => it.placement === 'IN_STOCK') && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-sky-400 font-bold flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          從倉庫獎項庫存快速帶入 (選填)
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {availableWarehouseItems.length > 0
                            ? `可用備品 ${availableWarehouseItems.length} 種`
                            : '已全數上板'}
                        </span>
                      </div>
                      <select
                        value={selectedInventoryId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedInventoryId(id);
                          if (!id) return;
                          const found = availableWarehouseItems.find((it) => it.item_id === id);
                          if (found) {
                            setPrizeNameInput(found.name);
                            const costStr = String(found.unit_cost || 0);
                            setPrizeCostInput(costStr);
                            if (isCashbackInput && (!cashbackAmountInput || Number(cashbackAmountInput) === 0)) {
                              setCashbackAmountInput(costStr);
                            }
                          }
                        }}
                        disabled={availableWarehouseItems.length === 0}
                        className={`w-full bg-[#111827] border rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none transition-colors ${
                          availableWarehouseItems.length === 0
                            ? 'border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                            : 'border-slate-700 focus:border-sky-500'
                        }`}
                      >
                        <option value="">
                          {availableWarehouseItems.length === 0
                            ? '-- 倉庫備品已全部上板，無剩餘可用庫存 --'
                            : '-- 手動自行填寫 / 非庫存品 --'}
                        </option>
                        {availableWarehouseItems.map((it) => (
                          <option key={it.item_id} value={it.item_id}>
                            {it.name} (成本 ${it.unit_cost} / 庫存 {it.quantity} 件)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-amber-400 font-bold mb-1">
                        獎號 (必填)*
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={prizeNumberInput}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                          e.target.select();
                        }}
                        onChange={(e) => setPrizeNumberInput(e.target.value)}
                        placeholder="如 18"
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        名稱 (選填)
                      </label>
                      <input
                        type="text"
                        value={prizeNameInput}
                        onChange={(e) => setPrizeNameInput(e.target.value)}
                        placeholder="大獎/公仔"
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        成本 ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prizeCostInput === '0' ? '' : prizeCostInput}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                          e.target.select();
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrizeCostInput(val);
                          if (isCashbackInput && (!cashbackAmountInput || Number(cashbackAmountInput) === 0)) {
                            setCashbackAmountInput(val);
                          }
                        }}
                        placeholder="0"
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* 回錢勾選與金額 (勾選自動預設帶入成本，提供同成本快捷鍵) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCashbackInput}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsCashbackInput(checked);
                          if (checked) {
                            const cost = Number(prizeCostInput);
                            if (cost > 0 && (!cashbackAmountInput || Number(cashbackAmountInput) === 0)) {
                              setCashbackAmountInput(String(cost));
                            }
                          }
                        }}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      可回錢
                    </label>

                    {isCashbackInput && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-amber-400 font-bold">$</span>
                        <input
                          type="number"
                          min={10}
                          step={10}
                          required
                          value={cashbackAmountInput === '0' ? '' : cashbackAmountInput}
                          onFocus={(e) => {
                            if (e.target.value === '0') e.target.value = '';
                            e.target.select();
                          }}
                          onChange={(e) => setCashbackAmountInput(e.target.value)}
                          placeholder="回錢金額"
                          className="w-28 bg-[#111827] border border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none"
                        />
                        {Number(prizeCostInput) > 0 && (
                          <button
                            type="button"
                            onClick={() => setCashbackAmountInput(prizeCostInput)}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${
                              cashbackAmountInput === prizeCostInput
                                ? 'bg-amber-500/25 border-amber-500/50 text-amber-300'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                            }`}
                            title={`帶入成本金額 $${prizeCostInput}`}
                          >
                            同成本
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 同步登記機台庫存勾選框 (做法 A：手動自填商品時，可勾選同步登記至該機台庫存) */}
                  {Number(prizeCostInput) > 0 && prizeNameInput.trim() && !selectedInventoryId && (
                    <div className="pt-2 border-t border-slate-800">
                      <label className="flex items-center gap-2 text-xs font-bold text-sky-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncToMachineInventory}
                          onChange={(e) => setSyncToMachineInventory(e.target.checked)}
                          className="w-4 h-4 accent-sky-500 rounded"
                        />
                        <span>同步登記為該機台庫存 (在台商品，自動計入壓貨資金)</span>
                      </label>
                    </div>
                  )}

                  {/* 貼入獎號按鈕：獨立整列置底 (需求 3) */}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + 貼入獎號
                  </button>

                  {formError && (
                    <div className="text-[11px] text-rose-400 font-bold">{formError}</div>
                  )}
                </form>

                {/* 獎項卡片網格 */}
                {selectedBoard.prizes.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    尚未貼入獎號
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedBoard.prizes.map((p) => (
                      <div
                        key={p.item_id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          p.is_claimed
                            ? 'bg-emerald-500/15 border-emerald-500/40'
                            : 'bg-[#0B0F17] border-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (p.is_claimed) {
                              onTogglePrizeClaimed(selectedBoard.board_id, p.item_id);
                              return;
                            }
                            if (p.is_cashback && p.prize_cost > 0) {
                              setChoiceModalPrize(p);
                              return;
                            }
                            if (p.is_cashback && (!p.prize_cost || p.prize_cost === 0)) {
                              onTogglePrizeClaimed(selectedBoard.board_id, p.item_id, 'CASHBACK');
                              return;
                            }
                            onTogglePrizeClaimed(selectedBoard.board_id, p.item_id, 'PHYSICAL');
                          }}
                          className="flex items-center gap-2 text-left min-w-0 flex-1"
                        >
                          <span
                            className={`w-8 h-8 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                              p.is_claimed
                                ? p.claim_type === 'CASHBACK'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-amber-400'
                            }`}
                          >
                            #{String(p.number_label).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {p.prize_name || (p.is_cashback ? '回錢獎' : '大獎')}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {p.is_claimed ? (
                                p.claim_type === 'PHYSICAL' ? (
                                  <span className="text-emerald-400 font-bold">🎁 拿獎 (${p.prize_cost})</span>
                                ) : p.claim_type === 'CASHBACK' ? (
                                  <span className="text-amber-400 font-bold">💵 回錢 -${p.cashback_amount}</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">已開出</span>
                                )
                              ) : p.is_cashback && p.prize_cost > 0 ? (
                                <span className="text-amber-300 font-medium">
                                  拿獎(${p.prize_cost}) / 回錢(${p.cashback_amount})
                                </span>
                              ) : p.is_cashback ? (
                                <span className="text-amber-400">
                                  回錢 -${p.cashback_amount}
                                </span>
                              ) : p.prize_cost > 0 ? (
                                `成本 $${p.prize_cost}`
                              ) : (
                                '一般獎'
                              )}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onDeletePrizeFromBoard(selectedBoard.board_id, p.item_id)
                          }
                          className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
                          title="刪除獎項"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* 主分頁 2：刮板紀錄與統計 (需求 5：獨立專屬空間，已結算板清單＋運氣分析) */
        <div className="space-y-4">
          {/* 子切換標籤 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatsViewMode('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statsViewMode === 'history'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#111827] text-slate-400 hover:text-white border border-[#1E293B]'
              }`}
            >
              📜 已結算歷史帳本 ({settledBoards.length} 版)
            </button>
            <button
              type="button"
              onClick={() => setStatsViewMode('luck')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statsViewMode === 'luck'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#111827] text-slate-400 hover:text-white border border-[#1E293B]'
              }`}
            >
              🎯 選號開獎統計 (運氣矩陣)
            </button>
          </div>

          {statsViewMode === 'history' ? (
            /* A. 已結算刮板帳本列表 (需求 5) */
            <div className="space-y-3">
              {settledBoards.length === 0 ? (
                <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-8 text-center space-y-2">
                  <History className="w-8 h-8 mx-auto text-slate-600" />
                  <div className="text-white text-xs font-bold">尚無已結算的刮板紀錄</div>
                  <p className="text-slate-400 text-[11px]">
                    當台上的刮板開完或更換時，點擊「結算下版」，完整的上架時間、收幣、獎項成本與淨利將完整收錄於此。
                  </p>
                </div>
              ) : (
                settledBoards.map((board) => {
                  const m = machines.find((mc) => mc.machine_id === board.machine_id);
                  const fin = calculateScratchBoardFinancials(
                    board.board_cost,
                    board.gross_coin_revenue,
                    board.prizes
                  );
                  const claimedPrizes = board.prizes.filter((p) => p.is_claimed);

                  return (
                    <div
                      key={board.board_id}
                      className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 shrink-0">
                            [{m?.code || '機台'}] {board.board_letter || 'A'}板
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {board.total_holes} 刮 (全結算)
                          </span>
                        </div>

                        <span
                          className={`text-sm font-mono font-black shrink-0 ${
                            fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {fin.netProfit >= 0 ? '+' : ''}$
                          {fin.netProfit.toLocaleString()}
                        </span>
                      </div>

                      {/* 上版與下版時間 (需求 5) */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0B0F17] px-3 py-2 rounded-lg border border-slate-800/80">
                        <span>
                          上版：
                          {new Date(board.created_at).toLocaleString('zh-TW', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>
                          結算：
                          {board.settled_at
                            ? new Date(board.settled_at).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '已結算'}
                        </span>
                      </div>

                      {/* 財務摘要 */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800/60">
                          <div className="text-[10px] text-slate-500">面板總收幣</div>
                          <div className="font-bold text-white">
                            ${fin.grossCoinRevenue.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800/60">
                          <div className="text-[10px] text-slate-500">回錢支出</div>
                          <div className="font-bold text-amber-400">
                            -${fin.totalCashbackDeducted.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800/60">
                          <div className="text-[10px] text-slate-500">實質實收</div>
                          <div className="font-bold text-emerald-400">
                            ${fin.netCoinRevenue.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* 開出獎項紀錄 */}
                      {claimedPrizes.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] text-slate-400">開出獎項 ({claimedPrizes.length} 個)：</div>
                          <div className="flex flex-wrap gap-1.5">
                            {claimedPrizes.map((p) => (
                              <span
                                key={p.item_id}
                                className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300"
                              >
                                #{p.number_label} {p.prize_name || '大獎'}{' '}
                                {p.is_cashback
                                  ? `(回錢 $${p.cashback_amount})`
                                  : p.prize_cost > 0
                                  ? `(成本 $${p.prize_cost})`
                                  : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* B. 選號統計 (運氣矩陣) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 常用獎號與賺賠勝率 */}
                <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    常用獎號 ＆ 下版賺賠統計
                  </div>

                  <div className="space-y-2.5">
                    {luckStats.favoriteAndWinList.map((stat) => (
                      <div
                        key={stat.number_label}
                        className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 font-mono font-black text-sm text-amber-400 flex items-center justify-center">
                              #{String(stat.number_label).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-white">
                                選用 {stat.times_selected} 次 · 開出 {stat.times_claimed} 次
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {stat.win_boards_count} 勝 (賺) / {stat.loss_boards_count} 敗 (賠)
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`text-sm font-mono font-bold ${
                                stat.cumulative_board_profit >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {stat.cumulative_board_profit >= 0 ? '+' : ''}$
                              {stat.cumulative_board_profit.toLocaleString()}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              勝率 {stat.win_rate_pct}%
                            </div>
                          </div>
                        </div>

                        {/* 勝率量表 */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              stat.win_rate_pct >= 50
                                ? 'bg-emerald-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${stat.win_rate_pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 帶財號 vs 虧損號 */}
                <div className="space-y-4">
                  <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Flame className="w-4 h-4" />
                      帶財神號 TOP 5
                    </div>
                    {luckStats.profitLeaders.slice(0, 5).map((s) => (
                      <div
                        key={s.number_label}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-400">
                            #{String(s.number_label).padStart(2, '0')}
                          </span>
                          <span className="text-xs text-slate-300">
                            選 {s.times_selected} 次 ({s.win_boards_count}賺/{s.loss_boards_count}賠)
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          +${s.cumulative_board_profit.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#111827] border border-rose-500/30 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      虧損注意號
                    </div>
                    {luckStats.lossTrapList.length === 0 ? (
                      <div className="text-xs text-slate-500 py-2">目前無虧損紀錄</div>
                    ) : (
                      luckStats.lossTrapList.slice(0, 5).map((s) => (
                        <div
                          key={s.number_label}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-rose-400">
                              #{String(s.number_label).padStart(2, '0')}
                            </span>
                            <span className="text-xs text-slate-300">
                              選 {s.times_selected} 次 ({s.loss_boards_count} 版虧損)
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-rose-400">
                            {s.cumulative_board_profit >= 0 ? '+' : ''}$
                            {s.cumulative_board_profit.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 兌獎二擇一彈窗 (拿獎 vs 回錢，避免扣兩次 $3000，名稱精簡好明瞭) */}
      {choiceModalPrize && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl text-center">
            <div className="space-y-1">
              <span className="w-10 h-10 mx-auto rounded-xl bg-amber-500/20 text-amber-400 font-mono font-black text-base flex items-center justify-center">
                #{String(choiceModalPrize.number_label).padStart(2, '0')}
              </span>
              <h3 className="text-white font-bold text-sm">
                {choiceModalPrize.prize_name || '大獎'}
              </h3>
              <p className="text-slate-400 text-xs">
                本獎項具備實體商品 (成本 ${choiceModalPrize.prize_cost})，並提供回錢選項 (${choiceModalPrize.cashback_amount})
              </p>
            </div>

            <div className="text-xs text-amber-300 font-bold">
              請選擇客人本次兌獎方式：
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onTogglePrizeClaimed(
                    selectedBoard!.board_id,
                    choiceModalPrize.item_id,
                    'PHYSICAL'
                  );
                  setChoiceModalPrize(null);
                }}
                className="py-3 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-950/40 transition-colors"
              >
                <span className="text-base">🎁</span>
                <span>拿獎</span>
                <span className="text-[10px] font-mono opacity-80">(扣成本 ${choiceModalPrize.prize_cost})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onTogglePrizeClaimed(
                    selectedBoard!.board_id,
                    choiceModalPrize.item_id,
                    'CASHBACK'
                  );
                  setChoiceModalPrize(null);
                }}
                className="py-3 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-amber-950/40 transition-colors"
              >
                <span className="text-base">💵</span>
                <span>回錢</span>
                <span className="text-[10px] font-mono opacity-80">(退現金 ${choiceModalPrize.cashback_amount})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setChoiceModalPrize(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 統一整合式下版結清彈窗 (避免二次操作與重複計帳) */}
      <SettleBoardModal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        board={selectedBoard}
        machine={machines.find((m) => m.machine_id === selectedBoard?.machine_id) || null}
        inventoryItems={inventoryItems}
        onConfirmSettle={(payload) => {
          onSettleBoard(payload);
        }}
      />
    </div>
  );
};
