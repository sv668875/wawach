import React, { useState, useMemo, useEffect } from 'react';
import {
  Flag,
  X,
  Coins,
  Package,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  InventoryItem,
  Machine,
  ScratchBoard,
  SettleBoardPayload,
} from '../types';
import { calculateScratchBoardFinancials, formatProfit } from '../utils/calculations';

interface SettleBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: ScratchBoard | null;
  machine?: Machine | null;
  inventoryItems: InventoryItem[];
  prefilledCash?: number;
  onConfirmSettle: (payload: SettleBoardPayload) => void;
}

export const SettleBoardModal: React.FC<SettleBoardModalProps> = ({
  isOpen,
  onClose,
  board,
  machine,
  inventoryItems,
  prefilledCash = 0,
  onConfirmSettle,
}) => {
  if (!isOpen || !board) return null;

  const [isAlreadyRecorded, setIsAlreadyRecorded] = useState(false);
  const [finalCashInput, setFinalCashInput] = useState<number | string>(
    prefilledCash > 0 ? prefilledCash : 0
  );
  const [settledRemainingHolesInput, setSettledRemainingHolesInput] = useState<number | string>(
    board.remaining_holes
  );
  const [prizesAction, setPrizesAction] = useState<
    'RETURN_TO_WAREHOUSE' | 'KEEP_ON_MACHINE'
  >('RETURN_TO_WAREHOUSE');
  const [notes, setNotes] = useState('');

  // 當 prefilledCash 變更時同步更新
  useEffect(() => {
    if (prefilledCash > 0) {
      setFinalCashInput(prefilledCash);
      setIsAlreadyRecorded(false);
    }
  }, [prefilledCash]);

  useEffect(() => {
    if (board) {
      setSettledRemainingHolesInput(board.remaining_holes);
    }
  }, [board]);

  const claimedPrizes = (board.prizes || []).filter((p) => p.is_claimed);
  const unclaimedPrizes = (board.prizes || []).filter((p) => !p.is_claimed);

  const numFinalCash = Math.max(0, Number(finalCashInput) || 0);
  const addedCash = isAlreadyRecorded ? 0 : numFinalCash;
  const simulatedGross = (board.gross_coin_revenue || 0) + addedCash;

  const confirmedRemainingHoles = Math.min(
    board.total_holes,
    Math.max(0, Number(settledRemainingHolesInput) || 0)
  );
  const actualScratchedHoles = Math.max(0, board.total_holes - confirmedRemainingHoles);
  const avgGrossPerHole =
    actualScratchedHoles > 0 ? Math.round(simulatedGross / actualScratchedHoles) : 0;

  const fin = useMemo(() => {
    return calculateScratchBoardFinancials(
      board.board_cost,
      simulatedGross,
      board.prizes || []
    );
  }, [board, simulatedGross]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmSettle({
      boardId: board.board_id,
      finalCollectedCash: numFinalCash,
      isCashAlreadyRecorded: isAlreadyRecorded,
      remainingPrizesAction: prizesAction,
      settledRemainingHoles: confirmedRemainingHoles,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111827] border border-slate-700 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 手機端底部抽出拖曳把手 */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-[#0B0F17]/60">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0F17]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">
                  {machine ? `[${machine.code}] ` : ''}
                  {board.board_letter ? `${board.board_letter}板 ` : ''}
                  下版結清
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {board.total_holes} 刮
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                一次性完成收幣清0、剩餘獎品退庫與損益結算，避免二次操作與重複計帳
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* 1. 看板基本資訊條 */}
          <div className="bg-[#0B0F17] rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">上版時間</span>
              <span className="text-slate-300">
                {new Date(board.created_at).toLocaleString('zh-TW', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="text-center">
              <span className="text-slate-500 block text-[10px]">已開大獎</span>
              <span className="text-emerald-400 font-bold">
                {claimedPrizes.length} / {board.prizes.length} 獎已開
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">總刮數</span>
              <span className="text-amber-400 font-bold">
                {board.total_holes} 刮
              </span>
            </div>
          </div>

          {/* 1.1 下版洞數與均出確認 (需求 3 & 7：大獎出清提早下版，精準記錄剩餘洞數與每洞均投) */}
          <div className="bg-[#0B0F17] rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                下版刮開洞數確認 (大獎出清提早下版分析)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                總刮數 {board.total_holes} 洞
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  下版時剩餘洞數
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={board.total_holes}
                  value={settledRemainingHolesInput}
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                    e.target.select();
                  }}
                  onChange={(e) =>
                    setSettledRemainingHolesInput(
                      e.target.value === '' ? '' : Math.max(0, Math.min(board.total_holes, Number(e.target.value)))
                    )
                  }
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="bg-[#111827] p-2 rounded-lg border border-slate-800/80 flex flex-col justify-center">
                <div className="text-[10px] text-slate-400">實際被刮開</div>
                <div className="text-sm font-mono font-bold text-amber-400">
                  {actualScratchedHoles} 洞{' '}
                  <span className="text-[10px] text-slate-500">
                    ({Math.round((actualScratchedHoles / (board.total_holes || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-sky-950/20 border border-sky-800/30 text-xs">
              <span className="text-sky-300">每洞平均毛收 (均投)</span>
              <span className="font-mono font-bold text-sky-200">
                約 ${avgGrossPerHole} 元 / 洞
              </span>
            </div>
          </div>

          {/* 2. 收幣結清方式 (核心防呆：防止重複加總) */}
          <div className="bg-[#0B0F17] rounded-xl p-3.5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Coins className="w-4 h-4" />
                <span>面板收幣結算</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                先前已累計收幣：
                <strong className="text-white">
                  ${(board.gross_coin_revenue || 0).toLocaleString()}
                </strong>
              </span>
            </div>

            <div className="space-y-2">
              {/* 選項 A：本次有新收幣要入帳 */}
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  !isAlreadyRecorded
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="cashSettleMode"
                  checked={!isAlreadyRecorded}
                  onChange={() => setIsAlreadyRecorded(false)}
                  className="mt-1 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      本次機台面板有收幣要結清 (開箱收幣)
                    </span>
                    <span className="text-[10px] text-amber-400">
                      自動同步產生清0紀錄
                    </span>
                  </div>

                  {!isAlreadyRecorded && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">本次收幣金額: $</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={10}
                          value={finalCashInput === 0 ? '' : finalCashInput}
                          onFocus={(e) => {
                            if (e.target.value === '0') e.target.value = '';
                            e.target.select();
                          }}
                          onChange={(e) =>
                            setFinalCashInput(
                              e.target.value === '' ? 0 : Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="flex-1 bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        累計先前 ${(board.gross_coin_revenue || 0).toLocaleString()} +
                        本次 ${numFinalCash.toLocaleString()} = 最終總收幣{' '}
                        <strong className="text-white">
                          ${simulatedGross.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* 選項 B：本板收幣先前巡場時已全部登記完畢 */}
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isAlreadyRecorded
                    ? 'bg-emerald-500/10 border-emerald-500/50'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="cashSettleMode"
                  checked={isAlreadyRecorded}
                  onChange={() => setIsAlreadyRecorded(true)}
                  className="mt-1 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-white block">
                    本板收幣先前巡場時已全部登記完畢
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    直接以先前累計的{' '}
                    <strong className="text-emerald-300">
                      ${(board.gross_coin_revenue || 0).toLocaleString()}
                    </strong>{' '}
                    為本板最終總收幣，不再重複加算金額。
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. 未開出獎項退回確認 (若有) */}
          <div className="bg-[#0B0F17] rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Package className="w-4 h-4" />
                <span>獎項清算與庫存處理</span>
              </div>
              <span className="text-[10px] text-slate-500">
                未開出獎品成本 $0，不扣本板利潤
              </span>
            </div>

            {unclaimedPrizes.length === 0 ? (
              <div className="text-xs text-slate-400 flex items-center gap-1.5 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>本板所有獎項已全數開出中獎，無剩餘庫存需退回。</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-300">
                  尚有{' '}
                  <strong className="text-amber-400">
                    {unclaimedPrizes.length}
                  </strong>{' '}
                  個未被刮出之獎項：
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-900/60 rounded-lg border border-slate-800">
                  {unclaimedPrizes.map((p) => (
                    <span
                      key={p.item_id}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      #{p.number_label} {p.prize_name || (p.is_cashback ? '回錢' : '獎品')}
                      {p.prize_cost > 0 && ` (成本 $${p.prize_cost})`}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPrizesAction('RETURN_TO_WAREHOUSE')}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      prizesAction === 'RETURN_TO_WAREHOUSE'
                        ? 'bg-sky-500/10 border-sky-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>📦 退回倉庫庫存</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      轉為倉庫備品，移出機台
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrizesAction('KEEP_ON_MACHINE')}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      prizesAction === 'KEEP_ON_MACHINE'
                        ? 'bg-sky-500/10 border-sky-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>🕹️ 保留在機台</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      留在原機台給下一版用
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. 本板最終損益預覽卡片 */}
          <div className="bg-[#0B0F17] rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">本板結算損益試算</span>
              <span className="text-[11px] font-mono text-slate-400">
                實收幣量 - 獎品成本 - 板成本
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#111827]/80 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">總收幣</span>
                <span className="text-xs font-mono font-bold text-white">
                  ${fin.grossCoinRevenue.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#111827]/80 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">回錢折現</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  -${fin.totalCashbackDeducted.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#111827]/80 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">獎品成本</span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  -${fin.claimedPrizeCost.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">本板最終毛利/淨利</span>
              <div
                className={`text-xl font-mono font-bold flex items-center gap-1 ${
                  fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {fin.netProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span>
                  {formatProfit(fin.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. 備註 (選填) */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              下版備註 (選填)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例：大獎被清早下版、客人包尾下版..."
              className="w-full bg-[#0B0F17] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Flag className="w-4 h-4" />
              確認完成下版結清
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
