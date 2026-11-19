import React, { useState, useMemo, useEffect } from 'react';
import { Dices, Grid, RotateCcw, X, Check, Sparkles } from 'lucide-react';
import { ScratchBoard } from '../types';

interface ScratchHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBoards?: ScratchBoard[];
}

const PRESET_HOLES = [40, 60, 80, 100, 120, 160, 200];
const STORAGE_KEY = 'clawops_scratch_helper_v1';

interface SavedHelperState {
  playTotalHoles: number;
  scratchedNumbers: number[];
}

export const ScratchHelperModal: React.FC<ScratchHelperModalProps> = ({
  isOpen,
  onClose,
  activeBoards = [],
}) => {
  const [activeMode, setActiveMode] = useState<'PRIZE_PICK' | 'PLAY_PICK'>('PLAY_PICK');

  // --- Mode 1: 隨機選中獎號碼 (開板設定用) ---
  const [prizeTotalHoles, setPrizeTotalHoles] = useState<number>(80);
  const [prizePickCount, setPrizePickCount] = useState<number>(1);
  const [selectedRefBoardId, setSelectedRefBoardId] = useState<string>('');
  const [pickedPrizeNumbers, setPickedPrizeNumbers] = useState<number[]>([]);

  // --- Mode 2: 打台選刮哪一洞 (玩家打台輔助，完全獨立於記帳) ---
  const [playTotalHoles, setPlayTotalHoles] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedHelperState;
        if (parsed.playTotalHoles > 0) return parsed.playTotalHoles;
      }
    } catch {
      // ignore
    }
    return 80;
  });

  const [scratchedNumbers, setScratchedNumbers] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedHelperState;
        if (Array.isArray(parsed.scratchedNumbers)) return parsed.scratchedNumbers;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [quickInputText, setQuickInputText] = useState<string>('');
  const [playPickCount, setPlayPickCount] = useState<number>(1);
  const [suggestedPlayNumbers, setSuggestedPlayNumbers] = useState<number[]>([]);

  useEffect(() => {
    try {
      const state: SavedHelperState = {
        playTotalHoles,
        scratchedNumbers,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [playTotalHoles, scratchedNumbers]);

  // Mode 1: 計算排除名單（若有選擇進行中刮板，可排除已設定的獎號）
  const refBoard = useMemo(
    () => activeBoards.find((b) => b.board_id === selectedRefBoardId) || null,
    [activeBoards, selectedRefBoardId]
  );

  const handlePickPrizeNumbers = () => {
    const total = Math.max(1, Math.min(500, Number(prizeTotalHoles) || 80));
    const existingSet = new Set<number>(
      refBoard ? refBoard.prizes.map((p) => p.number_label) : []
    );
    const pool: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (!existingSet.has(i)) pool.push(i);
    }
    const count = Math.min(pool.length, Math.max(1, Number(prizePickCount) || 1));
    const copy = [...pool];
    const picked: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    setPickedPrizeNumbers(picked.sort((a, b) => a - b));
  };

  // Mode 2: 計算剩餘未刮號碼
  const scratchedSet = useMemo(() => new Set(scratchedNumbers), [scratchedNumbers]);
  const safePlayTotal = Math.max(1, Math.min(500, Number(playTotalHoles) || 80));

  const remainingPlayPool = useMemo(() => {
    const pool: number[] = [];
    for (let i = 1; i <= safePlayTotal; i++) {
      if (!scratchedSet.has(i)) pool.push(i);
    }
    return pool;
  }, [safePlayTotal, scratchedSet]);

  const toggleGridNumber = (num: number) => {
    setScratchedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
    setSuggestedPlayNumbers((prev) => prev.filter((n) => n !== num));
  };

  const handleApplyQuickScratched = () => {
    const nums = quickInputText
      .split(/[\s,，、]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= safePlayTotal);
    if (nums.length === 0) return;
    setScratchedNumbers((prev) => Array.from(new Set([...prev, ...nums])));
    setSuggestedPlayNumbers((prev) => prev.filter((n) => !nums.includes(n)));
    setQuickInputText('');
  };

  const handlePickPlayHole = () => {
    if (remainingPlayPool.length === 0) return;
    const count = Math.min(
      remainingPlayPool.length,
      Math.max(1, Number(playPickCount) || 1)
    );
    const copy = [...remainingPlayPool];
    const picked: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    setSuggestedPlayNumbers(picked.sort((a, b) => a - b));
  };

  const handleMarkSuggestedAsScratched = () => {
    if (suggestedPlayNumbers.length === 0) return;
    setScratchedNumbers((prev) =>
      Array.from(new Set([...prev, ...suggestedPlayNumbers]))
    );
    setSuggestedPlayNumbers([]);
  };

  const handleResetPlayBoard = () => {
    setScratchedNumbers([]);
    setSuggestedPlayNumbers([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#111827] border border-slate-700 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#0B0F17]/70">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Dices className="w-4 h-4 text-amber-400" />
            <span>隨機選號助手</span>
            <span className="text-[10px] font-normal text-slate-400">(不影響記帳數據)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Tab Mode Switch */}
        <div className="p-3 pb-0">
          <div className="grid grid-cols-2 bg-[#0B0F17] p-1 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setActiveMode('PLAY_PICK')}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                activeMode === 'PLAY_PICK'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              打台選刮哪一洞
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('PRIZE_PICK')}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                activeMode === 'PRIZE_PICK'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              隨機選中獎號碼
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {activeMode === 'PLAY_PICK' ? (
            <>
              {/* 總刮數設定 */}
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">這台刮板總共有幾洞？</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={500}
                      value={playTotalHoles === 0 ? '' : playTotalHoles}
                      onFocus={(e) => {
                        if (e.target.value === '0') e.target.value = '';
                        e.target.select();
                      }}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(500, Number(e.target.value) || 0));
                        setPlayTotalHoles(val);
                        setScratchedNumbers((prev) => prev.filter((n) => n <= val));
                        setSuggestedPlayNumbers([]);
                      }}
                      className="w-16 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400 text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400 font-mono">洞</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {PRESET_HOLES.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setPlayTotalHoles(h);
                        setScratchedNumbers((prev) => prev.filter((n) => n <= h));
                        setSuggestedPlayNumbers([]);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                        playTotalHoles === h
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#111827] text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {h}刮
                    </button>
                  ))}
                </div>
              </div>

              {/* 剩餘統計 & 重置 */}
              <div className="flex items-center justify-between bg-[#0B0F17] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">
                    已刮 <strong className="text-slate-200">{scratchedNumbers.filter((n) => n <= safePlayTotal).length}</strong>
                  </span>
                  <span className="text-slate-400">
                    剩餘 <strong className="text-emerald-400">{remainingPlayPool.length}</strong> / {safePlayTotal} 洞
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetPlayBoard}
                  className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] font-sans font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置全部</span>
                </button>
              </div>

              {/* 快速標記已刮號碼 */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={quickInputText}
                  onChange={(e) => setQuickInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyQuickScratched();
                    }
                  }}
                  placeholder="快速標記已刮號碼 (例: 5, 12, 33)"
                  className="flex-1 bg-[#0B0F17] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleApplyQuickScratched}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shrink-0"
                >
                  標記已刮
                </button>
              </div>

              {/* 隨機抽下一洞按鈕列 & 抽出結果 */}
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-slate-800 shrink-0">
                    {[1, 2, 3].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setPlayPickCount(cnt)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold ${
                          playPickCount === cnt
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cnt}洞
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={remainingPlayPool.length === 0}
                    onClick={handlePickPlayHole}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Dices className="w-4 h-4" />
                    <span>
                      {remainingPlayPool.length === 0 ? '已全部刮完' : '幫我隨機選下一洞'}
                    </span>
                  </button>
                </div>

                {suggestedPlayNumbers.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400">建議刮：</span>
                      {suggestedPlayNumbers.map((num) => (
                        <span
                          key={num}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-bold text-sm"
                        >
                          #{num}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkSuggestedAsScratched}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Check className="w-3 h-3" />
                      <span>已刮沒中</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 號碼格子（點擊標記已刮/未刮） */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Grid className="w-3 h-3" />
                    點擊號碼可切換「已刮過」
                  </span>
                  <span className="font-mono">
                    橘框=推薦 · 暗灰=已刮
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto p-1 bg-[#0B0F17] border border-slate-800 rounded-xl">
                  {Array.from({ length: safePlayTotal }, (_, i) => i + 1).map((num) => {
                    const isScratched = scratchedSet.has(num);
                    const isSuggested = suggestedPlayNumbers.includes(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => toggleGridNumber(num)}
                        className={`h-8 rounded-md text-xs font-mono font-bold transition-colors ${
                          isSuggested
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                            : isScratched
                            ? 'bg-slate-900/60 text-slate-600 line-through border border-slate-800/50'
                            : 'bg-[#111827] text-slate-200 border border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Mode 1: 隨機選中獎號碼 (台主開板設定獎號用) */
            <>
              {activeBoards.length > 0 && (
                <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    參考進行中刮板 (選填，可自動帶入刮數並排除已設獎號)
                  </label>
                  <select
                    value={selectedRefBoardId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedRefBoardId(id);
                      const found = activeBoards.find((b) => b.board_id === id);
                      if (found) setPrizeTotalHoles(found.total_holes);
                      setPickedPrizeNumbers([]);
                    }}
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">不指定（自訂刮數純抽號）</option>
                    {activeBoards.map((b) => (
                      <option key={b.board_id} value={b.board_id}>
                        {b.title} ({b.total_holes}刮 · 已設 {b.prizes.length} 個獎)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">刮板總刮數</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={500}
                      value={prizeTotalHoles === 0 ? '' : prizeTotalHoles}
                      onFocus={(e) => {
                        if (e.target.value === '0') e.target.value = '';
                        e.target.select();
                      }}
                      onChange={(e) =>
                        setPrizeTotalHoles(Math.max(1, Math.min(500, Number(e.target.value) || 0)))
                      }
                      className="w-16 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400 text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400 font-mono">刮</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {PRESET_HOLES.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setPrizeTotalHoles(h);
                        setSelectedRefBoardId('');
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                        prizeTotalHoles === h
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#111827] text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {h}刮
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">要隨機抽出幾個中獎號碼？</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setPrizePickCount(cnt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                          prizePickCount === cnt
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-[#111827] text-slate-400 border border-slate-800'
                        }`}
                      >
                        {cnt}個
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePickPrizeNumbers}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>隨機抽出中獎號碼</span>
                </button>
              </div>

              {pickedPrizeNumbers.length > 0 && (
                <div className="bg-[#0B0F17] border border-emerald-500/30 rounded-xl p-4 space-y-2 text-center">
                  <div className="text-xs text-slate-400">
                    從 1 ~ {prizeTotalHoles} 刮中隨機抽出（不重複）：
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                    {pickedPrizeNumbers.map((num) => (
                      <span
                        key={num}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-lg"
                      >
                        #{num}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
