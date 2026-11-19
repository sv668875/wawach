import React, { useState, useMemo, useEffect } from 'react';
import { Dices, RotateCcw, X, Check, Sparkles, ArrowLeftRight } from 'lucide-react';
import { ScratchBoard } from '../types';

interface ScratchHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBoards?: ScratchBoard[];
}

const PRIZE_PRESET_HOLES = [40, 60, 80, 100, 120, 160, 200];

const BOARD_GRID_PRESETS: { label: string; rows: number; cols: number }[] = [
  { label: '40刮', rows: 5, cols: 8 },
  { label: '60刮', rows: 6, cols: 10 },
  { label: '80刮', rows: 8, cols: 10 },
  { label: '100刮', rows: 10, cols: 10 },
  { label: '120刮', rows: 10, cols: 12 },
  { label: '160刮', rows: 10, cols: 16 },
  { label: '200刮', rows: 10, cols: 20 },
];

const STORAGE_KEY = 'clawops_scratch_helper_2d_v1';

interface Saved2DHelperState {
  rows: number;
  cols: number;
  scratchedCoords: string[]; // "row-col" (1-indexed, e.g. "3-6")
}

function parseCoord(coord: string): { r: number; c: number } {
  const [rStr, cStr] = coord.split('-');
  return { r: Number(rStr) || 1, c: Number(cStr) || 1 };
}

export const ScratchHelperModal: React.FC<ScratchHelperModalProps> = ({
  isOpen,
  onClose,
  activeBoards = [],
}) => {
  const [activeMode, setActiveMode] = useState<'PLAY_PICK' | 'PRIZE_PICK'>('PLAY_PICK');

  // --- Mode 1: 2D 二維定位選刮哪一洞 (玩家打台輔助，完全獨立於記帳) ---
  const [rows, setRows] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved2DHelperState;
        if (parsed.rows > 0) return parsed.rows;
      }
    } catch {
      // ignore
    }
    return 8;
  });

  const [cols, setCols] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved2DHelperState;
        if (parsed.cols > 0) return parsed.cols;
      }
    } catch {
      // ignore
    }
    return 10;
  });

  const [scratchedCoords, setScratchedCoords] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved2DHelperState;
        if (Array.isArray(parsed.scratchedCoords)) return parsed.scratchedCoords;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [playPickCount, setPlayPickCount] = useState<number>(1);
  const [suggestedCoords, setSuggestedCoords] = useState<string[]>([]);

  useEffect(() => {
    try {
      const state: Saved2DHelperState = {
        rows,
        cols,
        scratchedCoords,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [rows, cols, scratchedCoords]);

  // --- Mode 2: 隨機選中獎號碼 (台主開板設獎用) ---
  const [prizeTotalHoles, setPrizeTotalHoles] = useState<number>(80);
  const [prizePickCount, setPrizePickCount] = useState<number>(1);
  const [selectedRefBoardId, setSelectedRefBoardId] = useState<string>('');
  const [pickedPrizeNumbers, setPickedPrizeNumbers] = useState<number[]>([]);

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

  // Mode 2D Calculations
  const safeRows = Math.max(1, Math.min(30, Number(rows) || 8));
  const safeCols = Math.max(1, Math.min(30, Number(cols) || 10));
  const totalGridHoles = safeRows * safeCols;

  const validScratchedSet = useMemo(() => {
    const set = new Set<string>();
    scratchedCoords.forEach((coord) => {
      const { r, c } = parseCoord(coord);
      if (r >= 1 && r <= safeRows && c >= 1 && c <= safeCols) {
        set.add(`${r}-${c}`);
      }
    });
    return set;
  }, [scratchedCoords, safeRows, safeCols]);

  const remainingCoordPool = useMemo(() => {
    const pool: string[] = [];
    for (let r = 1; r <= safeRows; r++) {
      for (let c = 1; c <= safeCols; c++) {
        const key = `${r}-${c}`;
        if (!validScratchedSet.has(key)) {
          pool.push(key);
        }
      }
    }
    return pool;
  }, [safeRows, safeCols, validScratchedSet]);

  const toggleGridCoord = (coord: string) => {
    setScratchedCoords((prev) =>
      prev.includes(coord) ? prev.filter((item) => item !== coord) : [...prev, coord]
    );
    setSuggestedCoords((prev) => prev.filter((item) => item !== coord));
  };

  const handleSwapRowsCols = () => {
    setRows(safeCols);
    setCols(safeRows);
    setScratchedCoords((prev) =>
      prev.map((coord) => {
        const { r, c } = parseCoord(coord);
        return `${c}-${r}`;
      })
    );
    setSuggestedCoords((prev) =>
      prev.map((coord) => {
        const { r, c } = parseCoord(coord);
        return `${c}-${r}`;
      })
    );
  };

  const handleApplyPresetGrid = (nextRows: number, nextCols: number) => {
    setRows(nextRows);
    setCols(nextCols);
    setScratchedCoords([]);
    setSuggestedCoords([]);
  };

  const handlePickRandomPosition = () => {
    if (remainingCoordPool.length === 0) return;
    const count = Math.min(
      remainingCoordPool.length,
      Math.max(1, Number(playPickCount) || 1)
    );
    const copy = [...remainingCoordPool];
    const picked: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    setSuggestedCoords(picked);
  };

  const handleMarkSuggestedAsScratched = () => {
    if (suggestedCoords.length === 0) return;
    setScratchedCoords((prev) => Array.from(new Set([...prev, ...suggestedCoords])));
    setSuggestedCoords([]);
  };

  const handleResetPlayBoard = () => {
    setScratchedCoords([]);
    setSuggestedCoords([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#111827] border border-slate-700 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
              打台選刮哪一洞 (2D)
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
        <div className="p-4 overflow-y-auto space-y-3">
          {activeMode === 'PLAY_PICK' ? (
            <>
              {/* 1. 板面長寬規格 (橫排 × 豎排) */}
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-200">板面排列規格</span>
                  <span className="font-mono text-amber-400 font-bold">
                    共 {totalGridHoles} 洞
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {BOARD_GRID_PRESETS.map((preset) => {
                    const isMatch = safeRows === preset.rows && safeCols === preset.cols;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPresetGrid(preset.rows, preset.cols)}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                          isMatch
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-[#111827] text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {preset.label} ({preset.rows}×{preset.cols})
                      </button>
                    );
                  })}
                </div>

                {/* 自訂橫排數 × 每排幾格 + 橫豎互換 */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-slate-400 shrink-0">橫排(豎)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={30}
                      value={rows === 0 ? '' : rows}
                      onFocus={(e) => {
                        if (e.target.value === '0') e.target.value = '';
                        e.target.select();
                      }}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(30, Number(e.target.value) || 0));
                        setRows(val);
                        setSuggestedCoords([]);
                      }}
                      className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSwapRowsCols}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 shrink-0"
                    title="橫豎互換"
                    aria-label="橫豎互換"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-slate-400 shrink-0">每排格數</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={30}
                      value={cols === 0 ? '' : cols}
                      onFocus={(e) => {
                        if (e.target.value === '0') e.target.value = '';
                        e.target.select();
                      }}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(30, Number(e.target.value) || 0));
                        setCols(val);
                        setSuggestedCoords([]);
                      }}
                      className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 剩餘洞數統計 & 重置 */}
              <div className="flex items-center justify-between bg-[#0B0F17] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">
                    已刮 <strong className="text-slate-200">{validScratchedSet.size}</strong>
                  </span>
                  <span className="text-slate-400">
                    剩餘 <strong className="text-emerald-400">{remainingCoordPool.length}</strong> / {totalGridHoles} 洞
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

              {/* 3. 隨機選位置按鈕 & 2D 定位提示 */}
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
                    disabled={remainingCoordPool.length === 0}
                    onClick={handlePickRandomPosition}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Dices className="w-4 h-4" />
                    <span>
                      {remainingCoordPool.length === 0 ? '已全部刮完' : '幫我隨機選位置'}
                    </span>
                  </button>
                </div>

                {suggestedCoords.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-bold">
                        建議刮位置（由上往下 · 由左往右）：
                      </span>
                      <button
                        type="button"
                        onClick={handleMarkSuggestedAsScratched}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3 h-3" />
                        <span>已刮沒中</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedCoords.map((coord) => {
                        const { r, c } = parseCoord(coord);
                        return (
                          <div
                            key={coord}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs"
                          >
                            第 {r} 橫排 · 第 {c} 格
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. 2D 實體對照網格 (附橫向與豎向座標標尺) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>對照機台點掉已刮開位置</span>
                  <span className="font-mono">橘色=推薦 · ✕=已刮</span>
                </div>

                <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-2 overflow-x-auto max-h-64 overflow-y-auto">
                  <div className="inline-block min-w-full">
                    {/* 頂部橫向標尺 (第幾格 1..cols) */}
                    <div
                      className="grid gap-1 mb-1"
                      style={{
                        gridTemplateColumns: `22px repeat(${safeCols}, minmax(24px, 1fr))`,
                      }}
                    >
                      <div />
                      {Array.from({ length: safeCols }, (_, cIdx) => (
                        <div
                          key={`col-${cIdx + 1}`}
                          className="text-center text-[10px] font-mono text-slate-500 font-bold"
                        >
                          {cIdx + 1}
                        </div>
                      ))}
                    </div>

                    {/* 各橫排 (1..rows) */}
                    <div className="space-y-1">
                      {Array.from({ length: safeRows }, (_, rIdx) => {
                        const r = rIdx + 1;
                        return (
                          <div
                            key={`row-${r}`}
                            className="grid gap-1 items-center"
                            style={{
                              gridTemplateColumns: `22px repeat(${safeCols}, minmax(24px, 1fr))`,
                            }}
                          >
                            {/* 左側豎向標尺 (第幾橫排) */}
                            <div className="text-[10px] font-mono text-slate-500 font-bold text-right pr-1">
                              {r}
                            </div>

                            {Array.from({ length: safeCols }, (_, cIdx) => {
                              const c = cIdx + 1;
                              const key = `${r}-${c}`;
                              const isScratched = validScratchedSet.has(key);
                              const isSuggested = suggestedCoords.includes(key);

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => toggleGridCoord(key)}
                                  title={`第 ${r} 橫排 · 第 ${c} 格`}
                                  className={`h-7 rounded-md text-[10px] font-mono font-bold flex items-center justify-center transition-colors ${
                                    isSuggested
                                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                                      : isScratched
                                      ? 'bg-slate-900/70 text-slate-600 border border-slate-800/60'
                                      : 'bg-[#111827] text-slate-400 border border-slate-700/80 hover:border-slate-500'
                                  }`}
                                >
                                  {isSuggested ? '★' : isScratched ? '✕' : '·'}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Mode 2: 隨機選中獎號碼 (台主開板設定獎號用) */
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
                  {PRIZE_PRESET_HOLES.map((h) => (
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
