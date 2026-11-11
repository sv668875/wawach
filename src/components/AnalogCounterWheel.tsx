import React from 'react';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { formatSixDigit } from '../utils/calculations';

interface AnalogCounterWheelProps {
  label: string;
  subLabel: string;
  value: number;
  lastValue: number;
  accentColor: 'amber' | 'emerald';
  onChange: (newVal: number) => void;
}

export const AnalogCounterWheel: React.FC<AnalogCounterWheelProps> = ({
  label,
  subLabel,
  value,
  lastValue,
  accentColor,
  onChange,
}) => {
  const digits = formatSixDigit(value).split('').map(Number);
  const lastFormatted = formatSixDigit(lastValue);
  const isDropped = value < lastValue;

  const updateDigit = (index: number, delta: number) => {
    const placeValue = Math.pow(10, 5 - index);
    let nextVal = value + delta * placeValue;
    if (nextVal < 0) nextVal = 0;
    if (nextVal > 999999) nextVal = nextVal % 1000000;
    onChange(nextVal);
  };

  const handleQuickAdd = (delta: number) => {
    let nextVal = value + delta;
    if (nextVal < 0) nextVal = 0;
    if (nextVal > 999999) nextVal = nextVal % 1000000;
    onChange(nextVal);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    const num = raw === '' ? 0 : parseInt(raw, 10);
    onChange(Math.min(999999, Math.max(0, num)));
  };

  const accentText = accentColor === 'amber' ? 'text-amber-400' : 'text-emerald-400';
  const accentRing =
    accentColor === 'amber'
      ? 'focus:border-amber-500/80 focus:ring-amber-500/20'
      : 'focus:border-emerald-500/80 focus:ring-emerald-500/20';

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5">
      {/* 標題列：左側標題，右側「同前次讀數」按鈕，固定單行對齊，絕不被擠落 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className={`text-base font-bold tracking-tight ${accentText} truncate`}>
          {label}
        </h3>

        <button
          type="button"
          onClick={() => onChange(lastValue)}
          className="h-9 px-3 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap shrink-0 shadow-sm touch-manipulation"
          title="還原為上次抄錶讀數"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>同前次讀數</span>
        </button>
      </div>

      {/* 說明與上次底數狀態徽章：獨立一行，清晰呈現 */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-mono">
        <span className="truncate">{subLabel}</span>
        <span className="shrink-0 text-slate-300 font-medium">
          上次讀數 <strong className="text-white font-bold">{lastFormatted}</strong>
        </span>
      </div>

      {/* 6-Digit Mechanical Roller Casing */}
      <div className="bg-[#080B10] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-inner">
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {digits.map((digit, idx) => {
            const placeNames = ['十萬', '萬', '千', '百', '十', '個'];
            return (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[11px] text-slate-400 font-mono mb-1">
                  {placeNames[idx]}
                </span>
                <button
                  type="button"
                  onClick={() => updateDigit(idx, 1)}
                  className="w-full min-h-[42px] bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 rounded-t-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95 touch-manipulation"
                  aria-label={`${label} ${placeNames[idx]}位數加一`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-full py-2.5 bg-[#05070A] border-x border-slate-800 flex items-center justify-center relative">
                  <span
                    className={`font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-wider ${
                      isDropped ? 'text-amber-300' : 'text-slate-50'
                    }`}
                  >
                    {digit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateDigit(idx, -1)}
                  className="w-full min-h-[42px] bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 rounded-b-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95 touch-manipulation"
                  aria-label={`${label} ${placeNames[idx]}位數減一`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 直接輸入刻度數字 (Full Width 全寬寬敞輸入) + 4顆快捷按鈕均分整列 */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5">
          {/* 第一層：鍵盤直接輸入刻度數字 (寬敞大輸入框) */}
          <div className="flex items-center gap-2 bg-[#05070A] border border-slate-700/80 rounded-xl px-3 py-2.5 focus-within:border-amber-500/80 transition-colors">
            <span className="text-xs text-slate-400 font-bold whitespace-nowrap shrink-0">
              直接輸入刻度:
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={value === 0 ? '' : value}
              onFocus={(e) => {
                if (e.target.value === '0') e.target.value = '';
                e.target.select();
              }}
              onChange={handleDirectInput}
              placeholder="0 (輸入 0~999999)"
              className="w-full bg-transparent text-base font-mono tabular-nums font-bold text-white focus:outline-none placeholder-slate-600"
            />
            {value > 0 && (
              <button
                type="button"
                onClick={() => onChange(0)}
                className="h-8 px-2.5 min-h-[32px] text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 shrink-0 flex items-center justify-center active:scale-95 touch-manipulation transition-all"
              >
                歸零
              </button>
            )}
          </div>

          {/* 第二層：快捷步進加數按鈕 (四格均分整列，大熱區好按) */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(accentColor === 'amber' ? [10, 50, 100, 500] : [1, 2, 5, 10]).map(
              (step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleQuickAdd(step)}
                  className="h-10 min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/80 text-xs font-mono font-bold transition-all flex items-center justify-center shadow-sm touch-manipulation"
                >
                  +{step}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
