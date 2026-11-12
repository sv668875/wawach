import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Building,
  MapPin,
  Boxes,
  Package,
} from 'lucide-react';
import {
  ClearActionType,
  CounterResetMode,
  InventoryItem,
  Machine,
  MachineModel,
  MachineType,
  MeterReading,
  ScratchBoard,
  StockedItem,
} from '../types';
import {
  calculateSessionMetrics,
  formatSixDigit,
  generateSampleMeterPhotoBase64,
  getNextMachineCode,
} from '../utils/calculations';
import { AnalogCounterWheel } from './AnalogCounterWheel';

interface MeterTrackingViewProps {
  machines: Machine[];
  readings: MeterReading[];
  scratchBoards: ScratchBoard[];
  inventoryItems?: InventoryItem[];
  selectedMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
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
  onUpdateMachineType?: (
    machineId: string,
    machineType: MachineType,
    extra?: { guaranteed_amount?: number; target_payout_rate?: number }
  ) => void;
  onRestockMachine?: (
    machineId: string,
    stock: StockedItem,
    sourceInventoryItemId?: string
  ) => void;
  onDeleteReading?: (readingId: string) => void;
  onJumpToScratchBoard: (boardId?: string) => void;
}

const QUICK_HOLE_OPTIONS = [40, 60, 80, 100, 120, 160, 200];

export const MeterTrackingView: React.FC<MeterTrackingViewProps> = ({
  machines,
  readings,
  scratchBoards,
  inventoryItems = [],
  selectedMachineId: propSelectedMachineId,
  onSelectMachine,
  onSaveReading,
  onQuickMountBoard,
  onAddMachine,
  onDeleteMachine,
  onCalibrateCounters,
  onSwitchMachineModel,
  onUpdateMachineType,
  onRestockMachine,
  onDeleteReading,
  onJumpToScratchBoard,
}) => {
  const [internalMachineId, setInternalMachineId] = useState<string>(
    machines[0]?.machine_id || ''
  );
  const effectiveMachineId = propSelectedMachineId || internalMachineId;
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);

  // 1. 場地/店點提取與狀態管理 (最上層：先選場或是新增場，絕無任何強制假預設店點)
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    machines.forEach((m) => {
      const loc = (m.location || '').trim();
      if (loc) locSet.add(loc);
    });
    return Array.from(locSet);
  }, [machines]);

  const [customLocations, setCustomLocations] = useState<string[]>([]);

  const allLocations = useMemo(() => {
    const set = new Set([...availableLocations, ...customLocations]);
    return Array.from(set);
  }, [availableLocations, customLocations]);

  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
    const found = machines.find((m) => m.machine_id === effectiveMachineId);
    return found?.location?.trim() || availableLocations[0] || '';
  });

  // 當全域機台更換時，自動同步所屬場地
  useEffect(() => {
    const current = machines.find((m) => m.machine_id === effectiveMachineId);
    if (current && current.location && current.location.trim() !== selectedLocation) {
      setSelectedLocation(current.location.trim());
    }
  }, [effectiveMachineId, machines, selectedLocation]);

  // 當場地被刪光或無場地時，自動保持空值，有場地時選中第一個
  useEffect(() => {
    if (!selectedLocation && allLocations.length > 0) {
      setSelectedLocation(allLocations[0]);
    }
  }, [allLocations, selectedLocation]);

  // 屬於目前選取場地的機台清單
  const venueMachines = useMemo(() => {
    if (!selectedLocation) return [];
    return machines.filter(
      (m) => (m.location || '').trim() === selectedLocation.trim()
    );
  }, [machines, selectedLocation]);

  // 目前選中的機台（必須屬於目前場地，無則為 null）
  const selectedMachine = useMemo(() => {
    if (venueMachines.length === 0) return null;
    const match = venueMachines.find((m) => m.machine_id === effectiveMachineId);
    return match || venueMachines[0] || null;
  }, [venueMachines, effectiveMachineId]);

  // 切換場地時自動選中該場第一台機台
  const handleSelectLocation = (loc: string) => {
    setSelectedLocation(loc);
    const inLoc = machines.filter(
      (m) => (m.location || '').trim() === loc.trim()
    );
    if (inLoc.length > 0) {
      handleSelectMachine(inLoc[0]);
    }
  };

  // 新增場地彈窗狀態
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [addLocationError, setAddLocationError] = useState<string | null>(null);

  const handleCreateLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLocationInput.trim();
    if (!trimmed) {
      setAddLocationError('請輸入場地名稱');
      return;
    }
    if (allLocations.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setAddLocationError(`場地「${trimmed}」已存在`);
      return;
    }
    setCustomLocations((prev) => [...prev, trimmed]);
    setSelectedLocation(trimmed);
    setIsAddLocationModalOpen(false);
    setNewLocationInput('');
    setAddLocationError(null);
    openAddMachineModal(trimmed);
  };

  // 需求 4：數位機台記錄收幣後提示拿鑰匙歸零面板彈窗狀態
  const [isZeroReminderModalOpen, setIsZeroReminderModalOpen] = useState(false);
  const [zeroReminderAmount, setZeroReminderAmount] = useState(0);

  // 查看全部抄錶紀錄與刪除確認狀態
  const [isAllReadingsModalOpen, setIsAllReadingsModalOpen] = useState(false);
  const [readingToDelete, setReadingToDelete] = useState<MeterReading | null>(null);

  // 需求 8：新增機台防重錯誤提示
  const [addMachineError, setAddMachineError] = useState<string | null>(null);

  // 該機台所有進行中 (ACTIVE) 的看板清單 (支援同機台同時上多個版)
  const machineActiveBoards = useMemo(() => {
    if (!selectedMachine) return [];
    return scratchBoards.filter(
      (b) => b.machine_id === selectedMachine.machine_id && b.status === 'ACTIVE'
    );
  }, [scratchBoards, selectedMachine]);

  // 滾輪二手錶底數校準彈窗狀態
  const [isCalibrateOpen, setIsCalibrateOpen] = useState(false);
  const [calibrateCoin, setCalibrateCoin] = useState(0);
  const [calibratePrize, setCalibratePrize] = useState(0);

  // 上新版彈窗 (自訂洞數與版名)
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [mountCustomTitle, setMountCustomTitle] = useState('');

  const [panelAmount, setPanelAmount] = useState<number>(0);
  const [mountHoleCount, setMountHoleCount] = useState<number>(80);

  const [coinCounter, setCoinCounter] = useState<number>(
    selectedMachine ? selectedMachine.last_coin_counter : 0
  );
  const [prizeCounter, setPrizeCounter] = useState<number>(
    selectedMachine ? selectedMachine.last_prize_counter : 0
  );
  const [resetMode, setResetMode] = useState<CounterResetMode>('NORMAL');
  const [notes, setNotes] = useState<string>('');

  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [newMachineCode, setNewMachineCode] = useState(() => getNextMachineCode(machines));
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineType, setNewMachineType] = useState<MachineType>('STANDARD');
  const [newMachineGuaranteedAmount, setNewMachineGuaranteedAmount] = useState<number>(1980);
  const [newMachineTargetPayoutRate, setNewMachineTargetPayoutRate] = useState<number>(400);
  const [newMachineModel, setNewMachineModel] = useState<MachineModel>('DIGITAL');
  const [newMachineLocation, setNewMachineLocation] = useState('');
  const [newMachineRent, setNewMachineRent] = useState(4500);
  const [newMachineInitialCoin, setNewMachineInitialCoin] = useState(0);
  const [newMachineInitialPrize, setNewMachineInitialPrize] = useState(0);

  // 機台補貨彈窗狀態
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockSource, setRestockSource] = useState<'WAREHOUSE' | 'CUSTOM'>('WAREHOUSE');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [restockQty, setRestockQty] = useState<number>(1);
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemCost, setCustomItemCost] = useState<number>(350);

  // 倉庫中尚有庫存的商品列表
  const inStockWarehouseItems = useMemo(() => {
    return inventoryItems.filter(
      (item) => item.placement === 'IN_STOCK' && item.quantity > 0
    );
  }, [inventoryItems]);

  useEffect(() => {
    if (inStockWarehouseItems.length > 0 && !selectedInventoryId) {
      setSelectedInventoryId(inStockWarehouseItems[0].item_id);
    }
  }, [inStockWarehouseItems, selectedInventoryId]);

  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const [ocrResultNote, setOcrResultNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectMachine = (machine: Machine) => {
    if (onSelectMachine) {
      onSelectMachine(machine.machine_id);
    }
    setInternalMachineId(machine.machine_id);
    setCoinCounter(machine.last_coin_counter || 0);
    setPrizeCounter(machine.last_prize_counter || 0);
    setPanelAmount(0);
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

  const handleExecuteClearRecord = (clearAction: ClearActionType = 'SEGMENT_CLEAR') => {
    if (!selectedMachine) return;
    const isDigital = selectedMachine.machine_model === 'DIGITAL';
    const currentRevenue = isDigital ? panelAmount : sessionMetrics.revenue;
    // 依需求：收幣直接記錄在該機台現有刮板上；若無刮板則直接匯入機台自己本身的幣量
    const autoTargetBoardId = machineActiveBoards.length > 0 ? machineActiveBoards[0].board_id : null;

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
      targetBoardId: autoTargetBoardId,
      notes: notes.trim() || '記錄收幣',
    });

    if (isDigital) {
      setZeroReminderAmount(currentRevenue);
      setIsZeroReminderModalOpen(true);
    }

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

  const openAddMachineModal = (loc?: string) => {
    setNewMachineCode(getNextMachineCode(machines));
    setNewMachineName('');
    setNewMachineType('STANDARD');
    setNewMachineGuaranteedAmount(1980);
    setNewMachineTargetPayoutRate(400);
    setNewMachineLocation(loc || selectedLocation || allLocations[0] || '');
    setNewMachineRent(4500);
    setNewMachineInitialCoin(0);
    setNewMachineInitialPrize(0);
    setAddMachineError(null);
    setIsAddMachineOpen(true);
  };

  const handleCreateMachineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddMachineError(null);
    const trimmedCode = newMachineCode.trim().toUpperCase();
    if (!trimmedCode) {
      setAddMachineError('請填寫機台代號');
      return;
    }
    if (machines.some((m) => m.code.trim().toUpperCase() === trimmedCode)) {
      setAddMachineError(`機台代號 [${trimmedCode}] 已存在，請使用不同代號！`);
      return;
    }
    if (!newMachineName.trim()) {
      setAddMachineError('請填寫機台名稱');
      return;
    }

    const finalLocation = newMachineLocation.trim() || selectedLocation.trim();
    if (!finalLocation) {
      setAddMachineError('請填寫或選擇所屬場地 / 店點名稱！');
      return;
    }

    const initCoin = Math.max(0, Number(newMachineInitialCoin) || 0);
    const initPrize = Math.max(0, Number(newMachineInitialPrize) || 0);
    onAddMachine({
      code: trimmedCode,
      name: newMachineName.trim(),
      machine_model: newMachineModel,
      machine_type: newMachineType,
      guaranteed_amount: newMachineType === 'STANDARD' ? (Number(newMachineGuaranteedAmount) || undefined) : undefined,
      target_payout_rate: newMachineType === 'STANDARD' ? (Number(newMachineTargetPayoutRate) || undefined) : undefined,
      location: finalLocation,
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
      stocked_items: [],
    });
    setSelectedLocation(finalLocation);
    setNewMachineName('');
    setNewMachineInitialCoin(0);
    setNewMachineInitialPrize(0);
    setIsAddMachineOpen(false);
  };

  const handleRestockSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedMachine) return;
    if (restockSource === 'WAREHOUSE') {
      const chosenItem = inStockWarehouseItems.find((i) => i.item_id === selectedInventoryId) || inStockWarehouseItems[0];
      if (!chosenItem) return;
      const safeQty = Math.min(chosenItem.quantity, Math.max(1, Number(restockQty) || 1));
      const newStock: StockedItem = {
        item_id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        item_name: chosenItem.name,
        cost: chosenItem.unit_cost,
        quantity: safeQty,
        added_at: new Date().toISOString(),
      };
      if (onRestockMachine) {
        onRestockMachine(selectedMachine.machine_id, newStock, chosenItem.item_id);
      }
    } else {
      const trimmed = customItemName.trim();
      if (!trimmed) return;
      const newStock: StockedItem = {
        item_id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        item_name: trimmed,
        cost: Math.max(0, Number(customItemCost) || 0),
        quantity: Math.max(1, Number(restockQty) || 1),
        added_at: new Date().toISOString(),
      };
      if (onRestockMachine) {
        onRestockMachine(selectedMachine.machine_id, newStock);
      }
    }
    setIsRestockModalOpen(false);
    setCustomItemName('');
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

          {addMachineError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addMachineError}</span>
            </div>
          )}

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
                  placeholder="例如：一番賞專區台、公仔主推台"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* 需求 1：純機台 vs 刮板台 模式切換 */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">經營型態</label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewMachineType('STANDARD')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    newMachineType === 'STANDARD'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>純出貨娃娃機</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMachineType('SCRATCH_HYBRID')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    newMachineType === 'SCRATCH_HYBRID'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>刮板一番賞機</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {newMachineType === 'STANDARD'
                  ? '🧸 純出貨娃娃機：不顯示刮板干擾資訊，專注出貨件數、均出率與機台補貨'
                  : '🎟️ 刮板一番賞機：支援隨時上板、貼獎號、巡場進度與回錢扣減'}
              </p>
            </div>

            {newMachineType === 'STANDARD' && (
              <div className="grid grid-cols-2 gap-2 bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">保夾金額 ($)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={newMachineGuaranteedAmount === 0 ? '' : newMachineGuaranteedAmount}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setNewMachineGuaranteedAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="例如 1980"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">預期均出 ($/件)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={newMachineTargetPayoutRate === 0 ? '' : newMachineTargetPayoutRate}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setNewMachineTargetPayoutRate(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="例如 450"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
            )}

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
                  inputMode="numeric"
                  value={newMachineRent === 0 ? '' : newMachineRent}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                  onChange={(e) => setNewMachineRent(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">所屬場地 / 店點</label>
              {(selectedLocation || newMachineLocation) ? (
                <div>
                  <div className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-400 flex items-center justify-between cursor-not-allowed select-none">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-400/70" />
                      <span>{newMachineLocation || selectedLocation}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">（鎖定當前場地）</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    📍 新增機台將直接歸屬於當前選定的「{newMachineLocation || selectedLocation}」場地
                  </p>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={newMachineLocation}
                  onChange={(e) => setNewMachineLocation(e.target.value)}
                  placeholder="例如：逢甲夜市店、西門武昌店"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              )}
            </div>

            {/* 二手機台滾輪底數設定 */}
            <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                二手錶頭初始底數設定 (選填)
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                若為二手或已使用過機台，請填寫目前錶頭起始讀數，避免第一次抄錶誤算為爆額營收。
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-xs text-slate-400 mb-0.5">起始投幣底數</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={newMachineInitialCoin === 0 ? '' : newMachineInitialCoin}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setNewMachineInitialCoin(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-0.5">起始出貨底數</label>
                  <input
                    type="number"
                    inputMode="numeric"
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
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs shadow-sm touch-manipulation"
            >
              確認新增
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderAddLocationModal = () => {
    if (!isAddLocationModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
        <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400" />
              新增場地 / 店點
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsAddLocationModalOpen(false);
                setAddLocationError(null);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {addLocationError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{addLocationError}</span>
            </div>
          )}

          <form onSubmit={handleCreateLocationSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">場地名稱</label>
              <input
                type="text"
                required
                autoFocus
                value={newLocationInput}
                onChange={(e) => setNewLocationInput(e.target.value)}
                placeholder="例如：台中一中店、逢甲夜市二店"
                className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddLocationModalOpen(false);
                  setAddLocationError(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
              >
                建立並新增機台
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderRestockModal = () => {
    if (!isRestockModalOpen || !selectedMachine) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-amber-400" />
              <span>機台補貨登記 [{selectedMachine.code}]</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsRestockModalOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setRestockSource('WAREHOUSE')}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                restockSource === 'WAREHOUSE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              從倉庫備品調撥
            </button>
            <button
              type="button"
              onClick={() => setRestockSource('CUSTOM')}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                restockSource === 'CUSTOM'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              直接手動填寫
            </button>
          </div>

          <form onSubmit={handleRestockSubmit} className="space-y-3">
            {restockSource === 'WAREHOUSE' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">選擇倉庫備品</label>
                  {inStockWarehouseItems.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                      倉庫內目前無在庫商品。可改選「直接手動填寫」登記，或至庫存頁新增。
                    </div>
                  ) : (
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => setSelectedInventoryId(e.target.value)}
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      {inStockWarehouseItems.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.name} (庫存 {item.quantity} 件 · 成本 ${item.unit_cost})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">補入機台數量 (件)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={restockQty}
                    onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">商品名稱</label>
                  <input
                    type="text"
                    required
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder="例如：七龍珠公仔、藍牙喇叭"
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">數量 (件)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={restockQty}
                      onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">進貨成本 ($)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={customItemCost}
                      onChange={(e) => setCustomItemCost(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={restockSource === 'WAREHOUSE' && inStockWarehouseItems.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                確認補入機台
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const isDigitalMode = selectedMachine?.machine_model === 'DIGITAL';
  const allMachineReadings = useMemo(
    () =>
      selectedMachine
        ? readings.filter((r) => r.machine_id === selectedMachine.machine_id)
        : [],
    [readings, selectedMachine]
  );
  const machineReadings = allMachineReadings.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 1. 最頂部：先選場地或是新增場地 */}
      {allLocations.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Building className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-white">尚未建立任何場地 / 店點</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              目前尚未建立任何場地。請先點擊下方按鈕新增場地（例如：逢甲夜市店、西門武昌店），接著再建立屬於該場的機台與設定。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewLocationInput('');
              setAddLocationError(null);
              setIsAddLocationModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            新增第一個場地
          </button>
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-400" />
              <span>選擇場地</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {selectedLocation || '未選取'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {allLocations.map((loc) => {
              const isSelected = loc === selectedLocation;
              const count = machines.filter(
                (m) => (m.location || '').trim() === loc.trim()
              ).length;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleSelectLocation(loc)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-[#0B0F17] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>{loc}</span>
                  <span
                    className={`text-[11px] px-1 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}台
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setNewLocationInput('');
                setAddLocationError(null);
                setIsAddLocationModalOpen(true);
              }}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-dashed border-slate-700 text-slate-400 hover:text-amber-400 text-xs font-bold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增場</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. 第二層：選擇機台或是新增機台 (僅在已建立場地時顯示) */}
      {allLocations.length > 0 && (
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>[{selectedLocation}] 機台</span>
          </span>
          {selectedMachine && (
            <span className="text-[10px] text-slate-400 font-mono">
              [{selectedMachine.code}] {selectedMachine.name}
            </span>
          )}
        </div>

        {venueMachines.length === 0 ? (
          <div className="bg-[#0B0F17] border border-slate-800/80 rounded-xl p-5 text-center space-y-2.5">
            <div className="text-xs font-bold text-slate-300">
              📍 場地 [{selectedLocation}] 目前尚無機台
            </div>
            <p className="text-[11px] text-slate-500">
              請先在此場地新增機台，選定機台後將自動載入該台的收幣與刮板設定。
            </p>
            <button
              type="button"
              onClick={() => openAddMachineModal(selectedLocation)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              新增此場第一台機台
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {venueMachines.map((m) => {
              const isSelected = m.machine_id === selectedMachine?.machine_id;
              const hasBoard = scratchBoards.some(
                (b) => b.machine_id === m.machine_id && b.status === 'ACTIVE'
              );
              const isPure = (m.machine_type || (m.active_board_id ? 'SCRATCH_HYBRID' : 'STANDARD')) === 'STANDARD';
              return (
                <button
                  key={m.machine_id}
                  type="button"
                  onClick={() => handleSelectMachine(m)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                      : 'bg-[#0B0F17] border-[#1E293B] text-slate-400 hover:text-slate-200'
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
                      {isPure ? (
                        <span className="text-sky-400 font-medium">🧸 純出貨</span>
                      ) : (
                        <span className={hasBoard ? 'text-emerald-400' : 'text-slate-500'}>
                          {hasBoard ? '● 有版' : '○ 無版'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => openAddMachineModal(selectedLocation)}
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-dashed border-slate-700 text-slate-400 hover:text-amber-400 text-xs font-bold whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              新機台
            </button>
          </div>
        )}
      </div>
      )}

      {/* 3. 第三層：只有在新增機台並選擇機台後，才會出現其他設定！ */}
      {selectedMachine && (() => {
        const isPureMachine = (selectedMachine.machine_type || (selectedMachine.active_board_id ? 'SCRATCH_HYBRID' : 'STANDARD')) === 'STANDARD';
        const totalStockValuation = (selectedMachine.stocked_items || []).reduce(
          (sum, s) => sum + s.cost * s.quantity,
          0
        );
        const totalPrizeCount = selectedMachine.last_prize_counter || 0;
        const totalCoinCollected = (selectedMachine.last_coin_counter || 0) * (selectedMachine.coin_unit_value || 10);
        const avgPayoutPerPrize = totalPrizeCount > 0 ? Math.round(totalCoinCollected / totalPrizeCount) : 0;

        return (
          <>
            {/* 機台模式頂部區塊：純出貨台 vs 刮板台 (需求 1：純機台絕不出現「目前無版・一鍵上版」干擾資訊) */}
            {isPureMachine ? (
              <div className="bg-[#111827] border border-sky-500/30 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>純出貨娃娃機營運</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">
                          公仔 / 零食出貨
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">專注均出投幣比與在台壓貨補貨</div>
                    </div>
                  </div>

                  {onUpdateMachineType && (
                    <button
                      type="button"
                      onClick={() => onUpdateMachineType(selectedMachine.machine_id, 'SCRATCH_HYBRID')}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all shrink-0"
                      title="若要在此機台舉辦刮刮樂活動，可隨時轉為刮板一番賞機"
                    >
                      轉為刮板台 ➔
                    </button>
                  )}
                </div>

                {/* 關鍵營運指標：累計出貨件數、投幣累計、均出投幣比 */}
                <div className="grid grid-cols-3 gap-2 bg-[#0B0F17] p-3 rounded-xl border border-slate-800 text-center">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">累計出貨</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">
                      {totalPrizeCount.toLocaleString()} 件
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">累計投幣</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      ${totalCoinCollected.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">即時均投比</div>
                    <div className="text-sm font-mono font-bold text-white">
                      {totalPrizeCount > 0 ? `$${avgPayoutPerPrize}/件` : '尚未出貨'}
                    </div>
                  </div>
                </div>

                {/* 均投健康度與保夾提示 */}
                {(selectedMachine.target_payout_rate || selectedMachine.guaranteed_amount) && (
                  <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    {selectedMachine.target_payout_rate ? (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-400">目標均出：</span>
                        <span className="text-white font-bold">${selectedMachine.target_payout_rate}/件</span>
                        {totalPrizeCount > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              avgPayoutPerPrize >= selectedMachine.target_payout_rate * 0.9
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {avgPayoutPerPrize >= selectedMachine.target_payout_rate
                              ? '毛利達標'
                              : '出貨偏快'}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {selectedMachine.guaranteed_amount ? (
                      <div className="text-slate-400 font-mono text-[11px]">
                        保夾金額：<span className="text-amber-400 font-bold">${selectedMachine.guaranteed_amount}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 在台壓貨商品列表與補貨按鈕 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-amber-400" />
                      <span>在台壓貨商品 (總值 ${totalStockValuation.toLocaleString()})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRestockQty(1);
                        setCustomItemName('');
                        setCustomItemCost(350);
                        setIsRestockModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>登記機台補貨</span>
                    </button>
                  </div>

                  {(!selectedMachine.stocked_items || selectedMachine.stocked_items.length === 0) ? (
                    <div className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800/80 text-center text-xs text-slate-500">
                      目前尚未登記此機台壓貨商品。點擊「登記機台補貨」可從倉庫調撥商品上機。
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedMachine.stocked_items.map((stk) => (
                        <div
                          key={stk.item_id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            <span className="font-bold text-white">{stk.item_name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">x {stk.quantity} 件</span>
                          </div>
                          <div className="font-mono text-slate-300 text-[11px]">
                            成本 ${stk.cost.toLocaleString()}/件 (總值 ${(stk.cost * stk.quantity).toLocaleString()})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 刮板一番賞機營運卡片 (支援同機台多板並存、個別下版) */
              machineActiveBoards.length === 0 ? (
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

                    {onUpdateMachineType && (
                      <button
                        type="button"
                        onClick={() => onUpdateMachineType(selectedMachine.machine_id, 'STANDARD')}
                        className="text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg active:scale-95 transition-all"
                        title="切換此機台為純出貨娃娃機"
                      >
                        轉為純娃娃機 ➔
                      </button>
                    )}
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
                    <div className="flex items-center gap-1.5">
                      {onUpdateMachineType && (
                        <button
                          type="button"
                          onClick={() => onUpdateMachineType(selectedMachine.machine_id, 'STANDARD')}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-bold transition-colors"
                          title="切換此機台為純出貨娃娃機"
                        >
                          轉純機
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMountModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        再上一版
                      </button>
                    </div>
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
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold whitespace-nowrap flex items-center gap-1"
                          >
                            <span>管理獎項</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
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

              {/* 收幣流向清晰提示徽章 (純機台直接匯入機台營收，刮板台直接入板) */}
              <div className="bg-[#0B0F17] px-3.5 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>收幣記錄流向：</span>
                </span>
                {isPureMachine ? (
                  <span className="font-mono text-sky-400 font-bold flex items-center gap-1 text-[11px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                    <span>🧸 純出貨機台（直接計入此台投幣營收與出貨率）</span>
                  </span>
                ) : machineActiveBoards.length > 0 ? (
                  <span className="font-mono text-emerald-400 font-bold flex items-center gap-1 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    <span>🎯 直接匯入現有 [{machineActiveBoards[0].board_letter || 'A'}板]</span>
                  </span>
                ) : (
                  <span className="font-mono text-slate-400 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    🎰 無進行中看板（直接匯入機台本身幣量）
                  </span>
                )}
              </div>

        {isDigitalMode ? (
          <div className="space-y-4">
            {/* 金額大字輸入 */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-200">數位面板金額</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold">
                    單位：元 (1 = 1元)
                  </span>
                </div>
                <span className="font-mono text-amber-400">
                  折合 {Math.round(panelAmount / (selectedMachine.coin_unit_value || 10))} 枚幣
                </span>
              </div>

              <div className="relative flex items-center">
                <span className="text-2xl font-mono font-bold text-amber-400 mr-2">$</span>
                <input
                  type="number"
                  inputMode="numeric"
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
                  className="w-full bg-transparent text-3xl font-mono font-bold tabular-nums text-white focus:outline-none"
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

            {/* 單一核心收幣大按鈕 */}
            <button
              type="button"
              onClick={() => handleExecuteClearRecord('SEGMENT_CLEAR')}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 active:scale-95 text-slate-950 font-bold text-sm transition-all shadow-sm touch-manipulation"
            >
              <RotateCcw className="w-4 h-4" />
              <span>記錄收幣</span>
            </button>
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
                subLabel="單位：枚 (1格 = 10元)"
                value={coinCounter}
                lastValue={selectedMachine.last_coin_counter}
                accentColor="amber"
                onChange={setCoinCounter}
              />
              <AnalogCounterWheel
                label="出貨錶 (PRIZE)"
                subLabel="單位：件 (出貨數)"
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
                <div className="text-xs text-slate-400 font-medium">本期投幣</div>
                <div className="text-sm font-mono font-bold text-white">
                  +{sessionMetrics.coinDelta}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">換算營收</div>
                <div className="text-sm font-mono font-bold text-amber-400">
                  ${sessionMetrics.revenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">本期出貨</div>
                <div className="text-sm font-mono font-bold text-emerald-400">
                  {sessionMetrics.prizeDelta} 件
                </div>
              </div>
            </div>

            {/* 單一核心抄錶收幣大按鈕 */}
            <button
              type="button"
              onClick={() => handleExecuteClearRecord('SEGMENT_CLEAR')}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 active:scale-95 text-slate-950 font-bold text-sm transition-all shadow-sm touch-manipulation"
            >
              <RotateCcw className="w-4 h-4" />
              <span>記錄收幣</span>
            </button>
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
          {allMachineReadings.length > 6 && (
            <button
              type="button"
              onClick={() => setIsAllReadingsModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold active:scale-95 transition-all touch-manipulation"
            >
              查看全部 ({allMachineReadings.length}) ➔
            </button>
          )}
        </div>

        {machineReadings.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">尚無紀錄</div>
        ) : (
          <div className="space-y-2">
            {machineReadings.map((r) => (
              <div
                key={r.reading_id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800/80 gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                      r.clear_action === 'BOARD_CLOSE_CLEAR'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {r.clear_action === 'BOARD_CLOSE_CLEAR' ? '結算下版' : '巡場收幣'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {r.notes || '收幣紀錄'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {new Date(r.read_at).toLocaleString('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono font-bold text-amber-400">
                    +${r.cash_collected.toLocaleString()}
                  </span>
                  {onDeleteReading && (
                    <button
                      type="button"
                      onClick={() => setReadingToDelete(r)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all touch-manipulation"
                      title="刪除/撤銷此筆抄錶紀錄"
                      aria-label="刪除此筆抄錶紀錄"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm"
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
                  inputMode="numeric"
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
                  inputMode="numeric"
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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                確認上版
              </button>
            </div>
          </div>
        </div>
      )}
          </>
        );
      })()}

      {renderAddMachineModal()}
      {renderAddLocationModal()}
      {renderRestockModal()}

      {/* 數位面板歸零提醒彈窗 */}
      {isZeroReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 text-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center text-xl">
              🔑
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">收幣已記錄</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                已記錄 [{selectedMachine?.code}] 收幣{' '}
                <span className="font-mono font-bold text-amber-400">
                  ${zeroReminderAmount.toLocaleString()}
                </span>{' '}
                元。
              </p>
              <p className="text-xs text-amber-400/90 font-medium">
                請以鑰匙將機板數位面板清零，確保下次讀數準確。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsZeroReminderModalOpen(false)}
              className="w-full min-h-[42px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-sm touch-manipulation"
            >
              確認已歸零
            </button>
          </div>
        </div>
      )}

      {/* 全部抄錶紀錄檢視彈窗 (手機自適應 Bottom Sheet) */}
      {isAllReadingsModalOpen && selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:fade-in duration-200">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <History className="w-4 h-4 text-amber-400" />
                <span>全部抄錶收幣紀錄 [{selectedMachine.code}]</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAllReadingsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allMachineReadings.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">尚無抄錶紀錄</div>
              ) : (
                allMachineReadings.map((r, idx) => (
                  <div
                    key={r.reading_id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.clear_action === 'BOARD_CLOSE_CLEAR'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {r.clear_action === 'BOARD_CLOSE_CLEAR' ? '結算下版' : '巡場收幣'}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                            最新
                          </span>
                        )}
                        <span className="text-slate-200 truncate font-medium">
                          {r.notes || '收幣紀錄'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-amber-400">
                          +${r.cash_collected.toLocaleString()}
                        </span>
                        {onDeleteReading && (
                          <button
                            type="button"
                            onClick={() => setReadingToDelete(r)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all touch-manipulation"
                            title="刪除/撤銷此筆紀錄"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5">
                      <span>投幣錶讀數: {r.coin_counter.toLocaleString()} (增+{r.coins_delta})</span>
                      <span>{new Date(r.read_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAllReadingsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all shrink-0 active:scale-95 touch-manipulation"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 單筆抄錶紀錄刪除確認彈窗 */}
      {readingToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-white font-bold text-sm">確認撤銷/刪除此筆收幣紀錄？</h4>
                <p className="text-xs text-slate-300">
                  金額：<span className="font-mono font-bold text-amber-400">+${readingToDelete.cash_collected.toLocaleString()}</span> 元
                  <br />
                  時間：{new Date(readingToDelete.read_at).toLocaleString()}
                </p>
                <p className="text-[11px] text-amber-300/90 pt-1">
                  💡 若此筆為最新抄錶，刪除後系統將自動將機台讀數底數回退至前一次抄錶，維持數據準確。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReadingToDelete(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all active:scale-95 touch-manipulation"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteReading) {
                    onDeleteReading(readingToDelete.reading_id);
                  }
                  setReadingToDelete(null);
                }}
                className="py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-all active:scale-95 touch-manipulation shadow-sm"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
