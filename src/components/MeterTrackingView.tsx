import React, { useState, useMemo, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  History,
  Upload,
  X,
  RefreshCw,
  Cpu,
  Gauge,
  Grid,
  RotateCcw,
  Flag,
  Coins,
  ArrowRight,
  Trash2,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import {
  ClearActionType,
  CounterResetMode,
  InventoryItem,
  Machine,
  MachineModel,
  MeterReading,
  ScratchBoard,
  SettleBoardPayload,
} from '../types';
import {
  calculateSessionMetrics,
  formatSixDigit,
  generateSampleMeterPhotoBase64,
} from '../utils/calculations';
import { AnalogCounterWheel } from './AnalogCounterWheel';
import { SettleBoardModal } from './SettleBoardModal';

interface MeterTrackingViewProps {
  machines: Machine[];
  readings: MeterReading[];
  scratchBoards: ScratchBoard[];
  inventoryItems?: InventoryItem[];
  onSaveReading: (payload: {
    machineId: string;
    entryMode: MachineModel;
    clearAction: ClearActionType;
    panelAmount: number;
    coinCounter: number;
    prizeCounter: number;
    resetMode: CounterResetMode;
    notes: string;
    targetBoardId?: string | null;
  }) => void;
  onQuickMountBoard: (machineId: string, totalHoles: number, customTitle?: string) => void;
  onAddMachine: (newMachine: Omit<Machine, 'machine_id' | 'last_read_at'>) => void;
  onDeleteMachine: (machineId: string) => void;
  onCalibrateCounters: (machineId: string, initialCoin: number, initialPrize: number) => void;
  onSwitchMachineModel: (machineId: string, model: MachineModel) => void;
  onJumpToScratchBoard: (boardId?: string) => void;
  onSettleBoard?: (payload: SettleBoardPayload | string) => void;
}

const QUICK_HOLE_OPTIONS = [40, 60, 80, 100, 120, 160, 200];

export const MeterTrackingView: React.FC<MeterTrackingViewProps> = ({
  machines,
  readings,
  scratchBoards,
  inventoryItems = [],
  onSaveReading,
  onQuickMountBoard,
  onAddMachine,
  onDeleteMachine,
  onCalibrateCounters,
  onSwitchMachineModel,
  onJumpToScratchBoard,
  onSettleBoard,
}) => {
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    machines[0]?.machine_id || ''
  );
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);

  // 統一整合式下版結清彈窗狀態 (避免二次操作與重複計帳)
  const [modalSettleBoard, setModalSettleBoard] = useState<ScratchBoard | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [modalPrefilledCash, setModalPrefilledCash] = useState(0);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.machine_id === selectedMachineId) || machines[0],
    [machines, selectedMachineId]
  );

  // 該機台所有進行中 (ACTIVE) 的看板清單 (支援同機台同時上多個版)
  const machineActiveBoards = useMemo(() => {
    if (!selectedMachine) return [];
    return scratchBoards.filter(
      (b) => b.machine_id === selectedMachine.machine_id && b.status === 'ACTIVE'
    );
  }, [scratchBoards, selectedMachine]);

  // 指定收幣歸屬的板 ID（null 代表全機台）
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState<string | null>(null);

  // 滾輪二手錶底數校準彈窗狀態
  const [isCalibrateOpen, setIsCalibrateOpen] = useState(false);
  const [calibrateCoin, setCalibrateCoin] = useState(0);
  const [calibratePrize, setCalibratePrize] = useState(0);

  // 上新版彈窗 (自訂洞數與版名)
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [mountCustomTitle, setMountCustomTitle] = useState('');

  const [panelAmount, setPanelAmount] = useState<number>(1800);
  const [mountHoleCount, setMountHoleCount] = useState<number>(80);

  const [coinCounter, setCoinCounter] = useState<number>(
    selectedMachine ? selectedMachine.last_coin_counter + 260 : 0
  );
  const [prizeCounter, setPrizeCounter] = useState<number>(
    selectedMachine ? selectedMachine.last_prize_counter + 8 : 0
  );
  const [resetMode, setResetMode] = useState<CounterResetMode>('NORMAL');
  const [notes, setNotes] = useState<string>('');

  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [newMachineCode, setNewMachineCode] = useState('C01');
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineModel, setNewMachineModel] = useState<MachineModel>('DIGITAL');
  const [newMachineLocation, setNewMachineLocation] = useState('逢甲旗艦店');
  const [newMachineRent, setNewMachineRent] = useState(4500);
  const [newMachineInitialCoin, setNewMachineInitialCoin] = useState(0);
  const [newMachineInitialPrize, setNewMachineInitialPrize] = useState(0);

  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const [ocrResultNote, setOcrResultNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectMachine = (machine: Machine) => {
    setSelectedMachineId(machine.machine_id);
    setSelectedTargetBoardId(null);
    setCoinCounter(machine.last_coin_counter + 220);
    setPrizeCounter(machine.last_prize_counter + 6);
    setPanelAmount(1600);
    setResetMode('NORMAL');
    setNotes('');
    setOcrResultNote(null);
  };

  const sessionMetrics = useMemo(() => {
    if (!selectedMachine) {
      return {
        coinDelta: 0,
        prizeDelta: 0,
        revenue: 0,
        costPerPrize: 0,
        hasCounterDropWarning: false,
        coinDropped: false,
        prizeDropped: false,
      };
    }
    return calculateSessionMetrics(
      {
        currentCoinCounter: coinCounter,
        currentPrizeCounter: prizeCounter,
        lastCoinCounter: selectedMachine.last_coin_counter,
        lastPrizeCounter: selectedMachine.last_prize_counter,
        resetMode,
      },
      selectedMachine.coin_unit_value
    );
  }, [selectedMachine, coinCounter, prizeCounter, resetMode]);

  const handleExecuteClearRecord = (clearAction: ClearActionType) => {
    if (!selectedMachine) return;
    const isDigital = selectedMachine.machine_model === 'DIGITAL';
    const currentRevenue = isDigital ? panelAmount : sessionMetrics.revenue;

    // 如果是「下版清0 / 下版結算」，且當前機台有進行中的板面
    if (clearAction === 'BOARD_CLOSE_CLEAR') {
      let targetBoard = selectedTargetBoardId
        ? machineActiveBoards.find((b) => b.board_id === selectedTargetBoardId)
        : null;

      // 若未特別選定，但機台剛好有 1 個進行中板次，自動以該板為目標
      if (!targetBoard && machineActiveBoards.length === 1) {
        targetBoard = machineActiveBoards[0];
      }

      // 如果有對應的看板，直接呼叫統一的「下版結清」彈窗！一次把錢、錶、獎項、板子一起結清！
      if (targetBoard) {
        setModalSettleBoard(targetBoard);
        setModalPrefilledCash(currentRevenue);
        setIsSettleModalOpen(true);
        return;
      }
    }

    onSaveReading({
      machineId: selectedMachine.machine_id,
      entryMode: selectedMachine.machine_model,
      clearAction,
      panelAmount: currentRevenue,
      coinCounter: isDigital
        ? selectedMachine.last_coin_counter +
          Math.round(panelAmount / (selectedMachine.coin_unit_value || 10))
        : coinCounter,
      prizeCounter: isDigital ? selectedMachine.last_prize_counter : prizeCounter,
      resetMode,
      targetBoardId: selectedTargetBoardId,
      notes:
        notes.trim() ||
        (clearAction === 'BOARD_CLOSE_CLEAR' ? '下版清0' : '分段清0'),
    });

    setPanelAmount(0);
    setNotes('');
  };

  const handleQuickMount = () => {
    if (!selectedMachine) return;
    onQuickMountBoard(selectedMachine.machine_id, mountHoleCount);
  };

  const runAiMeterOcr = async (base64DataUrl: string) => {
    setOcrLoading(true);
    setOcrError(null);
    setOcrPreviewImage(base64DataUrl);

    try {
      const [metaPart, dataPart] = base64DataUrl.split(',');
      const mimeMatch = metaPart.match(/data:(.*?);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const response = await fetch('/api/ocr-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataPart,
          mimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '辨識失敗');
      }

      if (typeof data.coinCounter === 'number') setCoinCounter(data.coinCounter);
      if (typeof data.prizeCounter === 'number') setPrizeCounter(data.prizeCounter);
      setOcrResultNote(
        `AI 辨識完成 (${Math.round((data.confidence || 0.95) * 100)}%)`
      );
      setIsOcrModalOpen(false);
    } catch (err: any) {
      setOcrError(err.message || 'AI 辨識失敗');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleTestSimulatedCameraOcr = () => {
    if (!selectedMachine) return;
    const simCoin = selectedMachine.last_coin_counter + 340;
    const simPrize = selectedMachine.last_prize_counter + 11;
    const sampleDataUrl = generateSampleMeterPhotoBase64(
      simCoin,
      simPrize,
      selectedMachine.code
    );
    runAiMeterOcr(sampleDataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        runAiMeterOcr(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMachineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineCode.trim() || !newMachineName.trim()) return;
    const initCoin = Math.max(0, Number(newMachineInitialCoin) || 0);
    const initPrize = Math.max(0, Number(newMachineInitialPrize) || 0);
    onAddMachine({
      code: newMachineCode.trim().toUpperCase(),
      name: newMachineName.trim(),
      machine_model: newMachineModel,
      location: newMachineLocation.trim() || '預設場地',
      rent_monthly: Number(newMachineRent) || 4500,
      other_fixed_fee: 0,
      other_fee_note: '',
      coin_unit_value: 10,
      initial_coin_counter: initCoin,
      initial_prize_counter: initPrize,
      last_coin_counter: initCoin,
      last_prize_counter: initPrize,
      active_board_id: null,
      is_active: true,
    });
    setNewMachineName('');
    setNewMachineInitialCoin(0);
    setNewMachineInitialPrize(0);
    setIsAddMachineOpen(false);
  };

  const renderAddMachineModal = () => {
    if (!isAddMachineOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
        <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">新增機台</h3>
            <button
              type="button"
              onClick={() => setIsAddMachineOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateMachineSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">代號</label>
                <input
                  type="text"
                  required
                  value={newMachineCode}
                  onChange={(e) => setNewMachineCode(e.target.value)}
                  placeholder="C01"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">機台名稱</label>
                <input
                  type="text"
                  required
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder="例如：一番賞專區台"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">機台面板形式</label>
                <select
                  value={newMachineModel}
                  onChange={(e) => setNewMachineModel(e.target.value as MachineModel)}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="DIGITAL">數位面板 (清0模式)</option>
                  <option value="ANALOG">傳統滾輪 (抄錶模式)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">月台租 ($)</label>
                <input
                  type="number"
                  value={newMachineRent === 0 ? '' : newMachineRent}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                  onChange={(e) => setNewMachineRent(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">場地位置</label>
              <input
                type="text"
                value={newMachineLocation}
                onChange={(e) => setNewMachineLocation(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
              />
            </div>

            {/* 二手機台滾輪底數設定 */}
            <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                二手錶頭初始底數設定 (選填)
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                若為二手或已使用過機台，請填寫目前錶頭起始讀數，避免第一次抄錶誤算為爆額營收。
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">起始投幣底數</label>
                  <input
                    type="number"
                    min={0}
                    value={newMachineInitialCoin === 0 ? '' : newMachineInitialCoin}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setNewMachineInitialCoin(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">起始出貨底數</label>
                  <input
                    type="number"
                    min={0}
                    value={newMachineInitialPrize === 0 ? '' : newMachineInitialPrize}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setNewMachineInitialPrize(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              確認新增
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (!selectedMachine) {
    return (
      <div className="space-y-4">
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 mx-auto flex items-center justify-center">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">目前尚未建立任何機台</h3>
            <p className="text-xs text-slate-400 mt-1">
              點擊下方按鈕新增您的第一台娃娃機，即可開始收幣抄錶與刮板管理。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddMachineOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            新增第一台機台
          </button>
        </div>
        {renderAddMachineModal()}
      </div>
    );
  }

  const isDigitalMode = selectedMachine.machine_model === 'DIGITAL';
  const machineReadings = readings
    .filter((r) => r.machine_id === selectedMachine.machine_id)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 1. 機台橫向快選列 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {machines.map((m) => {
          const isSelected = m.machine_id === selectedMachine.machine_id;
          const hasBoard = scratchBoards.some(
            (b) => b.machine_id === m.machine_id && b.status === 'ACTIVE'
          );
          return (
            <button
              key={m.machine_id}
              type="button"
              onClick={() => handleSelectMachine(m)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                  : 'bg-[#111827] border-[#1E293B] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span
                className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {m.code}
              </span>
              <div>
                <div className="text-xs font-bold whitespace-nowrap">{m.name}</div>
                <div className="text-[10px] font-mono flex items-center gap-1.5 mt-0.5">
                  <span className={hasBoard ? 'text-emerald-400' : 'text-slate-500'}>
                    {hasBoard ? '● 有版' : '○ 無版'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsAddMachineOpen(true)}
          className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl bg-[#111827] border border-dashed border-slate-700 text-slate-400 hover:text-amber-400 text-xs font-bold whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          新機台
        </button>
      </div>

      {/* 2. 刮板狀態卡片 (支援同機台多板並存、個別下版) */}
      {machineActiveBoards.length === 0 ? (
        <div className="bg-[#111827] border border-amber-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Grid className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">目前無版・一鍵上版</div>
                <div className="text-[11px] text-slate-400">選刮數即上版，獎號可事後貼入</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_HOLE_OPTIONS.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setMountHoleCount(num)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  mountHoleCount === num
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#0B0F17] text-slate-300 border border-slate-800'
                }`}
              >
                {num}刮
              </button>
            ))}
            <div className="flex items-center gap-1 bg-[#0B0F17] border border-slate-800 rounded-lg px-2 py-1">
              <input
                type="number"
                min={10}
                max={500}
                value={mountHoleCount}
                onChange={(e) => setMountHoleCount(Number(e.target.value))}
                className="w-12 bg-transparent text-xs font-mono font-bold text-amber-400 text-center focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">刮</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onQuickMountBoard(selectedMachine.machine_id, mountHoleCount)}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            確認上版 ({mountHoleCount} 刮)
          </button>
        </div>
      ) : (
        <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Layers className="w-4 h-4" />
              <span>台上進行中看板 ({machineActiveBoards.length} 版)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMountModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              再上一版
            </button>
          </div>

          <div className="space-y-2">
            {machineActiveBoards.map((b) => (
              <div
                key={b.board_id}
                className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                    {b.board_seq ? `${b.board_seq}號` : '板'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {b.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      <span>剩 {b.remaining_holes}/{b.total_holes} 洞</span>
                      <span>·</span>
                      <span className="text-amber-400">
                        收 ${b.gross_coin_revenue.toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className="text-emerald-400">
                        獎 {b.prizes.filter((p) => p.is_claimed).length}/{b.prizes.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onJumpToScratchBoard(b.board_id)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold whitespace-nowrap"
                  >
                    管獎項
                  </button>
                  {onSettleBoard && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalSettleBoard(b);
                        setModalPrefilledCash(panelAmount);
                        setIsSettleModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold whitespace-nowrap"
                    >
                      下此版
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 核心收幣面板 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              [{selectedMachine.code}] 面板收幣紀錄
            </h2>
          </div>

          {/* 數位 / 類比切換小鈕與刪除按鈕 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onSwitchMachineModel(selectedMachine.machine_id, 'DIGITAL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap ${
                  isDigitalMode
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400'
                }`}
              >
                數位面板
              </button>
              <button
                type="button"
                onClick={() => onSwitchMachineModel(selectedMachine.machine_id, 'ANALOG')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap ${
                  !isDigitalMode
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400'
                }`}
              >
                傳統滾輪
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMachineToDelete(selectedMachine)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="刪除此機台與相關數據"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 多板獨立記帳：選擇本筆收幣歸屬哪一個板 */}
        {machineActiveBoards.length > 0 && (
          <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1 text-amber-400">
                <Layers className="w-3.5 h-3.5" />
                收幣歸屬看板：
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                {selectedTargetBoardId ? '將計入此版營收並同步扣抵' : '全機台總收（不分攤進單一看板）'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedTargetBoardId(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedTargetBoardId === null
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-[#111827] text-slate-400 border border-slate-800'
                }`}
              >
                全機台總收 (不指定板)
              </button>
              {machineActiveBoards.map((b) => (
                <button
                  key={b.board_id}
                  type="button"
                  onClick={() => setSelectedTargetBoardId(b.board_id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedTargetBoardId === b.board_id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-[#111827] text-slate-400 border border-slate-800'
                  }`}
                >
                  {b.board_letter ? `${b.board_letter}板` : (b.board_seq ? `${b.board_seq}號版` : b.title)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isDigitalMode ? (
          <div className="space-y-4">
            {/* 金額大字輸入 */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>當前數位面板金額</span>
                <span className="font-mono text-amber-400">
                  約 {Math.round(panelAmount / (selectedMachine.coin_unit_value || 10))} 枚幣
                </span>
              </div>

              <div className="relative flex items-center">
                <span className="text-2xl font-mono font-bold text-amber-400 mr-2">$</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={panelAmount === 0 ? '' : panelAmount}
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                    e.target.select();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPanelAmount(val === '' ? 0 : Math.max(0, Number(val)));
                  }}
                  className="w-full bg-transparent text-3xl font-mono font-black tabular-nums text-white focus:outline-none"
                  placeholder="0"
                />
                {panelAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setPanelAmount(0)}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
                  >
                    清除
                  </button>
                )}
              </div>

              {/* 快速金額按鈕 */}
              <div className="grid grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-slate-800/80">
                {[100, 500, 1000, 2000, 3000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPanelAmount((prev) => prev + val)}
                    className="py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-amber-300"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            {/* 選填簡短備註 */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="備註 (選填)"
              className="w-full bg-[#0B0F17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />

            {/* 兩個核心清0大按鈕 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleExecuteClearRecord('SEGMENT_CLEAR')}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md"
              >
                <div className="flex items-center gap-1.5 font-extrabold text-sm whitespace-nowrap">
                  <RotateCcw className="w-4 h-4" />
                  分段清0
                </div>
                <span className="text-[11px] font-semibold opacity-80 mt-0.5 whitespace-nowrap">
                  板續留・累加營收
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteClearRecord('BOARD_CLOSE_CLEAR')}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md"
              >
                <div className="flex items-center gap-1.5 font-extrabold text-sm whitespace-nowrap">
                  <Flag className="w-4 h-4" />
                  下版清0
                </div>
                <span className="text-[11px] font-semibold opacity-80 mt-0.5 whitespace-nowrap">
                  板已下・結算本版
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* 傳統滾輪錶模式 */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">6 位數機械滾輪</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCalibrateCoin(selectedMachine.last_coin_counter || 0);
                    setCalibratePrize(selectedMachine.last_prize_counter || 0);
                    setIsCalibrateOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
                  title="二手機台初始滾輪底數設定"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  校準底數
                </button>
                <button
                  type="button"
                  onClick={() => setIsOcrModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold"
                >
                  <Camera className="w-3.5 h-3.5" />
                  AI 拍錶辨識
                </button>
              </div>
            </div>

            {ocrResultNote && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{ocrResultNote}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnalogCounterWheel
                label="投幣錶 (COIN)"
                subLabel="累計投幣"
                value={coinCounter}
                lastValue={selectedMachine.last_coin_counter}
                accentColor="amber"
                onChange={setCoinCounter}
              />
              <AnalogCounterWheel
                label="出貨錶 (PRIZE)"
                subLabel="累計出貨"
                value={prizeCounter}
                lastValue={selectedMachine.last_prize_counter}
                accentColor="emerald"
                onChange={setPrizeCounter}
              />
            </div>

            {sessionMetrics.hasCounterDropWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  讀數小於前次，請選擇原因：
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetMode('OVERFLOW')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      resetMode === 'OVERFLOW'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#0B0F17] text-slate-300 border-slate-700'
                    }`}
                  >
                    翻轉歸零
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetMode('REPLACED')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      resetMode === 'REPLACED'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#0B0F17] text-slate-300 border-slate-700'
                    }`}
                  >
                    換新錶頭
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 bg-[#0B0F17] p-3 rounded-xl border border-slate-800 text-center">
              <div>
                <div className="text-[10px] text-slate-500">本期投幣</div>
                <div className="text-sm font-mono font-bold text-white">
                  +{sessionMetrics.coinDelta}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">換算營收</div>
                <div className="text-sm font-mono font-bold text-amber-400">
                  ${sessionMetrics.revenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">本期出貨</div>
                <div className="text-sm font-mono font-bold text-emerald-400">
                  {sessionMetrics.prizeDelta} 件
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleExecuteClearRecord('SEGMENT_CLEAR')}
                className="py-3 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs"
              >
                分段紀錄
              </button>
              <button
                type="button"
                onClick={() => handleExecuteClearRecord('BOARD_CLOSE_CLEAR')}
                className="py-3 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs"
              >
                下版結算
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. 近期清0紀錄 (手機卡片列表，不擠壓文字) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <History className="w-3.5 h-3.5 text-amber-400" />
            近期紀錄 ({selectedMachine.code})
          </div>
        </div>

        {machineReadings.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">尚無紀錄</div>
        ) : (
          <div className="space-y-2">
            {machineReadings.map((r) => (
              <div
                key={r.reading_id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                      r.clear_action === 'BOARD_CLOSE_CLEAR'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {r.clear_action === 'BOARD_CLOSE_CLEAR' ? '下版清0' : '分段清0'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {r.notes || '收幣紀錄'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {new Date(r.read_at).toLocaleString('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-mono font-bold text-amber-400 shrink-0 ml-2">
                  +${r.cash_collected.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增機台彈窗 */}
      {renderAddMachineModal()}

      {/* AI 拍錶辨識彈窗 */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                AI 錶頭辨識
              </h3>
              <button
                type="button"
                onClick={() => setIsOcrModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={ocrLoading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                拍照或上傳錶頭照片
              </button>

              <button
                type="button"
                disabled={ocrLoading}
                onClick={handleTestSimulatedCameraOcr}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                模擬測試照片辨識
              </button>
            </div>

            {ocrLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 py-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI 辨識中...
              </div>
            )}

            {ocrError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg">
                {ocrError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 刪除機台連帶清除確認彈窗 */}
      {machineToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-rose-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  確認刪除機台 [{machineToDelete.code}]？
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  機台名稱：{machineToDelete.name}
                </p>
              </div>
            </div>

            <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-3.5 space-y-2 text-xs text-rose-300">
              <div className="font-bold flex items-center gap-1.5 text-rose-200">
                <Trash2 className="w-4 h-4 text-rose-400" />
                此操作無法復原，將連帶永久清除：
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-300/80">
                <li>
                  該機台的所有收幣／抄錶歷史（共{' '}
                  <span className="font-bold font-mono text-white">
                    {readings.filter((r) => r.machine_id === machineToDelete.machine_id).length}
                  </span>{' '}
                  筆）
                </li>
                <li>
                  該機台綁定的刮刮樂活動看板（共{' '}
                  <span className="font-bold font-mono text-white">
                    {scratchBoards.filter((b) => b.machine_id === machineToDelete.machine_id).length}
                  </span>{' '}
                  個）
                </li>
                <li>該機台專屬的所有月固定租金與雜費紀錄</li>
                <li>擺設在該機台內的商品將自動移回「倉庫備品」</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMachineToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMachine(machineToDelete.machine_id);
                  setMachineToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/30"
              >
                確認連帶清除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 滾輪底數校準彈窗 */}
      {isCalibrateOpen && selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span>校準滾輪起始底數 [{selectedMachine.code}]</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCalibrateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              適用於二手機台或錶頭非 000000 的情況。設定此底數僅作為日後抄錶差額的起算基準點，<b>不會計入營業額</b>。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  目前投幣錶讀數 (Coin Counter)
                </label>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={calibrateCoin === 0 ? '' : calibrateCoin}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                  onChange={(e) => setCalibrateCoin(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1">
                  目前出貨錶讀數 (Prize Counter)
                </label>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={calibratePrize === 0 ? '' : calibratePrize}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                  onChange={(e) => setCalibratePrize(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCalibrateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onCalibrateCounters(selectedMachine.machine_id, calibrateCoin, calibratePrize);
                  setCoinCounter(calibrateCoin);
                  setPrizeCounter(calibratePrize);
                  setIsCalibrateOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-950/40"
              >
                確認更新底數
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 同機台再上一版彈窗 */}
      {isMountModalOpen && selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>[{selectedMachine.code}] 上架新版面</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMountModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                看板名稱 (選填，留空自動命名)
              </label>
              <input
                type="text"
                value={mountCustomTitle}
                onChange={(e) => setMountCustomTitle(e.target.value)}
                placeholder={`例如：${selectedMachine.code} ${machineActiveBoards.length + 1}號版`}
                className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">總刮數</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_HOLE_OPTIONS.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setMountHoleCount(num)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                      mountHoleCount === num
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#0B0F17] text-slate-300 border border-slate-800'
                    }`}
                  >
                    {num}刮
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsMountModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuickMountBoard(selectedMachine.machine_id, mountHoleCount, mountCustomTitle);
                  setMountCustomTitle('');
                  setIsMountModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-950/40"
              >
                確認上版
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 統一整合式下版結清彈窗 (避免二次操作與重複計帳) */}
      <SettleBoardModal
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false);
          setModalSettleBoard(null);
        }}
        board={modalSettleBoard}
        machine={
          modalSettleBoard
            ? machines.find((m) => m.machine_id === modalSettleBoard.machine_id) || selectedMachine
            : selectedMachine
        }
        inventoryItems={inventoryItems}
        prefilledCash={modalPrefilledCash}
        onConfirmSettle={(payload) => {
          if (onSettleBoard) {
            onSettleBoard(payload);
          }
          setPanelAmount(0);
          setNotes('');
        }}
      />
    </div>
  );
};
