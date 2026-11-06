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
      {/* Header row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className={`text-base font-semibold tracking-tight ${accentText}`}>
            {label}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {subLabel} <span aria-hidden="true">·</span> 上次讀數{' '}
            <span className="font-mono tabular-nums text-slate-200 font-medium">
              {lastFormatted}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(lastValue)}
          className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          title="還原為上次抄錶讀數"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          同前次讀數
        </button>
      </div>

      {/* 6-Digit Mechanical Roller Casing */}
      <div className="bg-[#080B10] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-inner">
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {digits.map((digit, idx) => {
            const placeNames = ['十萬', '萬', '千', '百', '十', '個'];
            return (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-mono mb-1">
                  {placeNames[idx]}
                </span>
                <button
                  type="button"
                  onClick={() => updateDigit(idx, 1)}
                  className="w-full min-h-[38px] bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 rounded-t-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  aria-label={`${label} ${placeNames[idx]}位數加一`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-full py-2.5 bg-[#05070A] border-x border-slate-800 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
                  <span
                    className={`font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-wider ${
                      isDropped ? 'text-amber-300' : 'text-slate-50'
                    }`}
                  >
                    {digit}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => updateDigit(idx, -1)}
                  className="w-full min-h-[38px] bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 rounded-b-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  aria-label={`${label} ${placeNames[idx]}位數減一`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Direct Numeric Input + Single-Hand Quick Step Buttons */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-400 whitespace-nowrap shrink-0">
              鍵盤快輸:
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={handleDirectInput}
              className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:ring-2 ${accentRing}`}
              placeholder="輸入 0~999999"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(accentColor === 'amber' ? [10, 50, 100, 500] : [1, 2, 5, 10]).map(
              (step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleQuickAdd(step)}
                  className="min-h-[40px] px-2.5 py-1.5 text-xs font-mono tabular-nums font-medium bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 border border-slate-700/80 rounded-lg transition-all whitespace-nowrap shrink-0"
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
