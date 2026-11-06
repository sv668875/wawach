import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Plus,
  CheckCircle2,
  Coins,
  History,
  Trash2,
  Flag,
  Sparkles,
  Flame,
  AlertTriangle,
  Grid,
} from 'lucide-react';
import {
  Machine,
  ScratchBoard,
} from '../types';
import {
  calculateScratchBoardFinancials,
  computeNumberLuckMatrix,
} from '../utils/calculations';

interface ScratchBoardViewProps {
  boards: ScratchBoard[];
  machines: Machine[];
  onQuickMountBoard: (machineId: string, totalHoles: number) => void;
  onAddPrizeToBoard: (
    boardId: string,
    prize: {
      numberLabel: number;
      prizeName?: string;
      isCashback: boolean;
      cashbackAmount: number;
      prizeCost: number;
    }
  ) => void;
  onTogglePrizeClaimed: (boardId: string, itemId: string) => void;
  onDeletePrizeFromBoard: (boardId: string, itemId: string) => void;
  onRecordBatchProgress: (payload: {
    boardId: string;
    remainingHoles: number;
    addedCashRevenue: number;
    newlyClaimedNumbers: number[];
    note: string;
  }) => void;
  onUpdateGrossRevenue: (boardId: string, newGrossRevenue: number) => void;
  onSettleBoard: (boardId: string) => void;
}

const HOLE_PRESETS = [40, 60, 80, 100, 120, 160, 200];

export const ScratchBoardView: React.FC<ScratchBoardViewProps> = ({
  boards,
  machines,
  onQuickMountBoard,
  onAddPrizeToBoard,
  onTogglePrizeClaimed,
  onDeletePrizeFromBoard,
  onRecordBatchProgress,
  onUpdateGrossRevenue,
  onSettleBoard,
}) => {
  // 簡化子分頁名稱：版面紀錄 vs 選號統計
  const [subTab, setSubTab] = useState<'board' | 'luck'>('board');

  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    boards.find((b) => b.status === 'ACTIVE')?.board_id ||
      boards[0]?.board_id ||
      ''
  );

  const selectedBoard = useMemo(
    () => boards.find((b) => b.board_id === selectedBoardId) || boards[0],
    [boards, selectedBoardId]
  );

  const [mountMachineId, setMountMachineId] = useState<string>(
    machines[0]?.machine_id || ''
  );
  const [mountHoles, setMountHoles] = useState<number>(80);

  // 新增獎項表單
  const [prizeNumberInput, setPrizeNumberInput] = useState<string>('');
  const [prizeNameInput, setPrizeNameInput] = useState<string>('');
  const [isCashbackInput, setIsCashbackInput] = useState<boolean>(false);
  const [cashbackAmountInput, setCashbackAmountInput] = useState<string>('');
  const [prizeCostInput, setPrizeCostInput] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // 分批紀錄表單
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

  const handleAddPrizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard) return;
    setFormError(null);

    const num = Number(prizeNumberInput);
    if (!prizeNumberInput.trim() || isNaN(num) || num < 1) {
      setFormError('請填寫獎號');
      return;
    }

    if (selectedBoard.prizes.some((p) => p.number_label === num)) {
      setFormError(`#${num} 已在名單中`);
      return;
    }

    const cbAmount = Number(cashbackAmountInput);
    if (isCashbackInput && (!cashbackAmountInput.trim() || isNaN(cbAmount) || cbAmount <= 0)) {
      setFormError('勾選回錢時，金額必填');
      return;
    }

    onAddPrizeToBoard(selectedBoard.board_id, {
      numberLabel: num,
      prizeName: prizeNameInput.trim() || undefined,
      isCashback: isCashbackInput,
      cashbackAmount: isCashbackInput ? cbAmount : 0,
      prizeCost: Number(prizeCostInput) || 0,
    });

    setPrizeNumberInput('');
    setPrizeNameInput('');
    setCashbackAmountInput('');
    setPrizeCostInput('');
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
      remainingHoles: Math.max(
        0,
        Math.min(selectedBoard.total_holes, batchRemainingHoles)
      ),
      addedCashRevenue: Math.max(0, Number(batchAddedCash) || 0),
      newlyClaimedNumbers: batchSelectedNumbers,
      note: '',
    });
    setBatchSelectedNumbers([]);
    setBatchAddedCash(0);
  };

  const scratchedPct = selectedBoard
    ? Math.round(
        ((selectedBoard.total_holes - selectedBoard.remaining_holes) /
          Math.max(1, selectedBoard.total_holes)) *
          100
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* 1. 簡潔雙子頁切換：版面紀錄 vs 選號統計 */}
      <div className="flex items-center justify-between gap-2 bg-[#111827] border border-[#1E293B] rounded-xl p-1.5">
        <button
          type="button"
          onClick={() => setSubTab('board')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            subTab === 'board'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          版面紀錄
        </button>

        <button
          type="button"
          onClick={() => setSubTab('luck')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            subTab === 'luck'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          選號統計
        </button>
      </div>

      {subTab === 'board' ? (
        <div className="space-y-4">
          {/* 快速上版列 */}
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

          {/* 版面橫向切換 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {boards.map((b) => {
              const isSelected = selectedBoard?.board_id === b.board_id;
              const m = machines.find((mc) => mc.machine_id === b.machine_id);
              return (
                <button
                  key={b.board_id}
                  type="button"
                  onClick={() => handleSelectBoard(b)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-[#111827] border-[#1E293B] text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                    <span className="font-mono text-amber-400">[{m?.code}]</span>
                    <span>{b.board_seq ? `${b.board_seq}號版` : ''} ({b.total_holes}刮)</span>
                    <span
                      className={`text-[10px] ${
                        b.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {b.status === 'ACTIVE' ? '● 台上' : '已結算'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 whitespace-nowrap">
                    剩 {b.remaining_holes} 洞 · 獎 {b.prizes.filter((p) => p.is_claimed).length}/{b.prizes.length}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedBoard && (
            <>
              {/* 本版核心損益量表卡片 */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {selectedBoard.title}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      已刮 {selectedBoard.total_holes - selectedBoard.remaining_holes} / {selectedBoard.total_holes} 洞 ({scratchedPct}%)
                    </div>
                  </div>
                  {selectedBoard.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => onSettleBoard(selectedBoard.board_id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 whitespace-nowrap"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      下版結算
                    </button>
                  )}
                </div>

                {/* 視覺化刮數進度條 */}
                <div className="w-full h-2.5 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, scratchedPct))}%` }}
                  />
                </div>

                {/* 4 格關鍵數字 */}
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
                  <span>分批紀錄（剩幾洞 & 開出獎號）</span>
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
                        value={batchRemainingHoles}
                        onChange={(e) =>
                          setBatchRemainingHoles(Number(e.target.value))
                        }
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
                        value={batchAddedCash || ''}
                        onChange={(e) =>
                          setBatchAddedCash(Number(e.target.value))
                        }
                        placeholder="$0"
                        className="w-full bg-transparent text-xl font-mono font-black text-white focus:outline-none"
                      />
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
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-[#0B0F17] text-slate-200 border-slate-800'
                                }`}
                              >
                                #{String(p.number_label).padStart(2, '0')}
                                {p.is_cashback
                                  ? ` 回$${p.cashback_amount}`
                                  : p.prize_name
                                  ? ` ${p.prize_name}`
                                  : ''}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
                  >
                    儲存本次進度
                  </button>
                </form>
              </div>

              {/* 獎項清單與貼入獎號 */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    本版獎項號碼 ({selectedBoard.prizes.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    點號碼可切換「已出 / 未出」
                  </span>
                </div>

                {/* 新增獎項精簡列 */}
                <form
                  onSubmit={handleAddPrizeSubmit}
                  className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5"
                >
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
                        onChange={(e) => setPrizeNumberInput(e.target.value)}
                        placeholder="如 18"
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
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
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        成本 (選填)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prizeCostInput}
                        onChange={(e) => setPrizeCostInput(e.target.value)}
                        placeholder="$0"
                        className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  {/* 回錢勾選與必填金額 */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isCashbackInput}
                        onChange={(e) => setIsCashbackInput(e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      可回錢 (中獎自動扣幣量)
                    </label>

                    {isCashbackInput && (
                      <input
                        type="number"
                        min={10}
                        required
                        value={cashbackAmountInput}
                        onChange={(e) => setCashbackAmountInput(e.target.value)}
                        placeholder="回錢金額 (必填)*"
                        className="w-36 bg-[#111827] border border-amber-500 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-300"
                      />
                    )}

                    <button
                      type="submit"
                      className="ml-auto px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold text-white transition-colors whitespace-nowrap"
                    >
                      + 貼入獎號
                    </button>
                  </div>

                  {formError && (
                    <div className="text-[11px] text-rose-400">{formError}</div>
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
                          onClick={() =>
                            onTogglePrizeClaimed(
                              selectedBoard.board_id,
                              p.item_id
                            )
                          }
                          className="flex items-center gap-2 text-left min-w-0 flex-1"
                        >
                          <span
                            className={`w-8 h-8 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                              p.is_claimed
                                ? 'bg-emerald-500 text-slate-950'
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
                              {p.is_cashback ? (
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
                            onDeletePrizeFromBoard(
                              selectedBoard.board_id,
                              p.item_id
                            )
                          }
                          className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
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
        /* 2. 選號統計 (樂趣功能：簡潔排行榜與勝率量表) */
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
  );
};
