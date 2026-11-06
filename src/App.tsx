import React, { useState, useEffect, useMemo } from 'react';
import {
  Gauge,
  Grid,
  Package,
  Wrench,
  BarChart3,
  Cpu,
} from 'lucide-react';
import {
  ClearActionType,
  CounterResetMode,
  Expense,
  InventoryItem,
  ItemPlacement,
  Machine,
  MachineCustomFee,
  MachineModel,
  MachinePaymentRecord,
  MeterReading,
  ScratchBoard,
} from './types';
import {
  INITIAL_CATEGORIES,
  INITIAL_EXPENSES,
  INITIAL_INVENTORY,
  INITIAL_MACHINES,
  INITIAL_READINGS,
  INITIAL_SCRATCH_BOARDS,
} from './data/seedData';
import {
  calculateScratchBoardFinancials,
  calculateSessionMetrics,
  calculateSimpleOverhead,
} from './utils/calculations';
import { MeterTrackingView } from './components/MeterTrackingView';
import { ScratchBoardView } from './components/ScratchBoardView';
import { InventoryView } from './components/InventoryView';
import { OverheadExpensesView } from './components/OverheadExpensesView';
import { FinancialAnalyticsView } from './components/FinancialAnalyticsView';
import { ErrorBoundary } from './components/ErrorBoundary';

type TabKey = 'meter' | 'scratch' | 'inventory' | 'overhead' | 'analytics';

const STORAGE_KEYS = {
  MACHINES: 'clawops_v3_machines',
  CATEGORIES: 'clawops_v3_categories',
  INVENTORY: 'clawops_v3_inventory',
  READINGS: 'clawops_v3_readings',
  SCRATCH_BOARDS: 'clawops_v3_scratch_boards',
  EXPENSES: 'clawops_v3_expenses',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('meter');

  const [machines, setMachines] = useState<Machine[]>(() =>
    loadFromStorage(STORAGE_KEYS.MACHINES, INITIAL_MACHINES)
  );
  const [categories, setCategories] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES)
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY)
  );
  const [readings, setReadings] = useState<MeterReading[]>(() =>
    loadFromStorage(STORAGE_KEYS.READINGS, INITIAL_READINGS)
  );
  const [scratchBoards, setScratchBoards] = useState<ScratchBoard[]>(() =>
    loadFromStorage(STORAGE_KEYS.SCRATCH_BOARDS, INITIAL_SCRATCH_BOARDS)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadFromStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES)
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
    } catch (e) {
      console.error(e);
    }
  }, [machines]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.error(e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.INVENTORY,
        JSON.stringify(inventoryItems)
      );
    } catch (e) {
      console.error(e);
    }
  }, [inventoryItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
    } catch (e) {
      console.error(e);
    }
  }, [readings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SCRATCH_BOARDS,
        JSON.stringify(scratchBoards)
      );
    } catch (e) {
      console.error(e);
    }
  }, [scratchBoards]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } catch (e) {
      console.error(e);
    }
  }, [expenses]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleSaveReading = (payload: {
    machineId: string;
    entryMode: MachineModel;
    clearAction: ClearActionType;
    panelAmount: number;
    coinCounter: number;
    prizeCounter: number;
    resetMode: CounterResetMode;
    notes: string;
    targetBoardId?: string | null;
  }) => {
    const targetMachine = machines.find(
      (m) => m.machine_id === payload.machineId
    );
    if (!targetMachine) return;

    const nowIso = new Date().toISOString();
    let cashAdded = 0;
    let coinsDelta = 0;
    let prizesDelta = 0;

    if (payload.entryMode === 'DIGITAL') {
      cashAdded = Math.max(0, Number(payload.panelAmount) || 0);
      coinsDelta = Math.round(
        cashAdded / (targetMachine.coin_unit_value || 10)
      );
      prizesDelta = 0;
    } else {
      const metrics = calculateSessionMetrics(
        {
          currentCoinCounter: payload.coinCounter,
          currentPrizeCounter: payload.prizeCounter,
          lastCoinCounter: targetMachine.last_coin_counter,
          lastPrizeCounter: targetMachine.last_prize_counter,
          resetMode: payload.resetMode,
        },
        targetMachine.coin_unit_value || 10
      );
      cashAdded = metrics.revenue;
      coinsDelta = metrics.coinDelta;
      prizesDelta = metrics.prizeDelta;
    }

    // 支援指定歸屬哪一個看板（多版獨立記帳）
    const activeBoardId =
      payload.targetBoardId !== undefined
        ? payload.targetBoardId
        : targetMachine.active_board_id || null;

    const newReading: MeterReading = {
      reading_id: `read_${Date.now()}`,
      machine_id: targetMachine.machine_id,
      board_id: activeBoardId,
      entry_mode: payload.entryMode,
      clear_action: payload.clearAction,
      read_at: nowIso,
      panel_amount: cashAdded,
      cash_collected: cashAdded,
      last_coin_counter: targetMachine.last_coin_counter,
      coin_counter:
        payload.entryMode === 'DIGITAL'
          ? targetMachine.last_coin_counter + coinsDelta
          : payload.coinCounter,
      last_prize_counter: targetMachine.last_prize_counter,
      prize_counter:
        payload.entryMode === 'DIGITAL'
          ? targetMachine.last_prize_counter
          : payload.prizeCounter,
      reset_mode: payload.resetMode,
      coins_delta: coinsDelta,
      prizes_delta: prizesDelta,
      notes: payload.notes,
    };

    setReadings((prev) => [newReading, ...prev]);

    if (activeBoardId) {
      setScratchBoards((prev) =>
        prev.map((b) => {
          if (b.board_id !== activeBoardId) return b;
          const nextGross = b.gross_coin_revenue + cashAdded;
          const fin = calculateScratchBoardFinancials(
            b.board_cost,
            nextGross,
            b.prizes
          );
          const isClosingBoard = payload.clearAction === 'BOARD_CLOSE_CLEAR';
          return {
            ...b,
            status: isClosingBoard ? 'SETTLED' : b.status,
            settled_at: isClosingBoard ? nowIso : b.settled_at,
            remaining_holes: isClosingBoard ? 0 : b.remaining_holes,
            gross_coin_revenue: fin.grossCoinRevenue,
            total_cashback_deducted: fin.totalCashbackDeducted,
            net_coin_revenue: fin.netCoinRevenue,
            total_prize_cost: fin.claimedPrizeCost,
            net_profit: fin.netProfit,
          };
        })
      );
    }

    setMachines((prev) =>
      prev.map((m) => {
        if (m.machine_id !== targetMachine.machine_id) return m;
        // 如果是下版清0，只清掉該特定版，若還有其他版則自動保留
        let updatedActiveBoardId = m.active_board_id;
        if (payload.clearAction === 'BOARD_CLOSE_CLEAR' && activeBoardId) {
          if (m.active_board_id === activeBoardId) {
            const otherActive = scratchBoards.find(
              (b) =>
                b.machine_id === m.machine_id &&
                b.board_id !== activeBoardId &&
                b.status === 'ACTIVE'
            );
            updatedActiveBoardId = otherActive ? otherActive.board_id : null;
          }
        }
        return {
          ...m,
          last_coin_counter: newReading.coin_counter,
          last_prize_counter: newReading.prize_counter,
          last_read_at: nowIso,
          active_board_id: updatedActiveBoardId,
        };
      })
    );

    showToast(
      payload.clearAction === 'BOARD_CLOSE_CLEAR'
        ? `[${targetMachine.code}] 下版清0 +$${cashAdded.toLocaleString()}`
        : `[${targetMachine.code}] 分段清0 +$${cashAdded.toLocaleString()}`
    );
  };

  const handleQuickMountBoard = (
    machineId: string,
    totalHoles: number,
    customTitle?: string
  ) => {
    const targetMachine = machines.find((m) => m.machine_id === machineId);
    if (!targetMachine) return;

    const nowIso = new Date().toISOString();
    const newBoardId = `sb_${Date.now()}`;
    const holeCount = Math.max(10, Number(totalHoles) || 80);

    // 智能填補缺號之英文字母版次 (A, B, C, D... 缺號自動遞補，需求 5)
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const currentActiveForMachine = scratchBoards.filter(
      (b) => b.machine_id === machineId && b.status === 'ACTIVE'
    );
    const usedLetters = new Set(
      currentActiveForMachine.map((b) => b.board_letter || 'A')
    );
    const nextLetter = LETTERS.find((char) => !usedLetters.has(char)) || 'A';
    const defaultTitle = `${targetMachine.code} ${nextLetter}板 (${holeCount}刮)`;

    const newBoard: ScratchBoard = {
      board_id: newBoardId,
      machine_id: machineId,
      board_letter: nextLetter,
      board_seq: LETTERS.indexOf(nextLetter) + 1,
      title: customTitle?.trim() || defaultTitle,
      total_holes: holeCount,
      remaining_holes: holeCount,
      board_cost: 0,
      status: 'ACTIVE',
      gross_coin_revenue: 0,
      total_cashback_deducted: 0,
      net_coin_revenue: 0,
      total_prize_cost: 0,
      net_profit: 0,
      prizes: [],
      check_logs: [],
      created_at: nowIso,
    };

    // 允許多個版同時在台上
    setScratchBoards((prev) => [newBoard, ...prev]);

    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === machineId ? { ...m, active_board_id: newBoardId } : m
      )
    );

    showToast(`[${targetMachine.code}] 已成功上架 ${nextLetter}板 (${holeCount}刮)`);
  };

  const handleAddPrizeToBoard = (
    boardId: string,
    prizeInput: {
      numberLabel: number;
      prizeName?: string;
      isCashback: boolean;
      cashbackAmount: number;
      prizeCost: number;
      syncToInventory?: boolean;
      inventoryItemId?: string;
    }
  ) => {
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    let assignedInvId = prizeInput.inventoryItemId;

    // 做法 A：若勾選「同步登記為該機台庫存」，自動在庫存中建立 ON_MACHINE 商品 (方便統計壓貨資金)
    if (prizeInput.syncToInventory && prizeInput.prizeName && prizeInput.prizeCost > 0) {
      const machineId = targetBoard?.machine_id || null;
      const targetMachine = machines.find((m) => m.machine_id === machineId);
      const newInvItem: InventoryItem = {
        item_id: `inv_${Date.now()}`,
        name: prizeInput.prizeName.trim(),
        category: '公仔大獎',
        acquisition_source: '採購',
        unit_cost: prizeInput.prizeCost,
        quantity: 1,
        placement: 'ON_MACHINE',
        machine_id: machineId,
        note: `自 [${targetMachine?.code || '機台'}] 刮板 #${prizeInput.numberLabel} 同步建檔`,
        updated_at: new Date().toISOString(),
      };
      assignedInvId = newInvItem.item_id;
      setInventoryItems((prev) => [newInvItem, ...prev]);
      showToast(`已加入 #${prizeInput.numberLabel} 並登記至 [${targetMachine?.code || '機台'}] 庫存`);
    } else {
      showToast(`已加入 #${String(prizeInput.numberLabel).padStart(2, '0')}`);
    }

    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== boardId) return b;
        const newPrize = {
          item_id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          board_id: boardId,
          number_label: prizeInput.numberLabel,
          prize_name: prizeInput.prizeName,
          is_cashback: prizeInput.isCashback,
          cashback_amount: prizeInput.isCashback
            ? prizeInput.cashbackAmount
            : 0,
          prize_cost: prizeInput.prizeCost || 0,
          inventory_item_id: assignedInvId,
          is_claimed: false,
        };
        const nextPrizes = [...b.prizes, newPrize].sort(
          (x, y) => x.number_label - y.number_label
        );
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          b.gross_coin_revenue,
          nextPrizes
        );
        return {
          ...b,
          prizes: nextPrizes,
          total_cashback_deducted: fin.totalCashbackDeducted,
          net_coin_revenue: fin.netCoinRevenue,
          total_prize_cost: fin.claimedPrizeCost,
          net_profit: fin.netProfit,
        };
      })
    );
  };

  const handleTogglePrizeClaimed = (
    boardId: string,
    itemId: string,
    claimType?: 'PHYSICAL' | 'CASHBACK'
  ) => {
    const nowIso = new Date().toISOString();

    // 當客人「拿獎」實體商品出貨時，若有綁定庫存品項，自動扣減庫存數量 1 件
    if (claimType === 'PHYSICAL') {
      const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
      const targetPrize = targetBoard?.prizes.find((p) => p.item_id === itemId);
      if (targetPrize?.inventory_item_id) {
        setInventoryItems((prev) =>
          prev
            .map((item) => {
              if (item.item_id !== targetPrize.inventory_item_id) return item;
              return {
                ...item,
                quantity: item.quantity - 1,
              };
            })
            .filter((item) => item.quantity > 0)
        );
      }
    }

    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== boardId) return b;
        const nextPrizes = b.prizes.map((p) => {
          if (p.item_id !== itemId) return p;
          const willBeClaimed = !p.is_claimed;
          return {
            ...p,
            is_claimed: willBeClaimed,
            claim_type: willBeClaimed
              ? claimType || (p.is_cashback && (!p.prize_cost || p.prize_cost === 0) ? 'CASHBACK' : 'PHYSICAL')
              : undefined,
            claimed_at: willBeClaimed ? nowIso : undefined,
          };
        });
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          b.gross_coin_revenue,
          nextPrizes
        );
        return {
          ...b,
          prizes: nextPrizes,
          total_cashback_deducted: fin.totalCashbackDeducted,
          net_coin_revenue: fin.netCoinRevenue,
          total_prize_cost: fin.claimedPrizeCost,
          net_profit: fin.netProfit,
        };
      })
    );
  };

  const handleDeletePrizeFromBoard = (boardId: string, itemId: string) => {
    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== boardId) return b;
        const nextPrizes = b.prizes.filter((p) => p.item_id !== itemId);
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          b.gross_coin_revenue,
          nextPrizes
        );
        return {
          ...b,
          prizes: nextPrizes,
          total_cashback_deducted: fin.totalCashbackDeducted,
          net_coin_revenue: fin.netCoinRevenue,
          total_prize_cost: fin.claimedPrizeCost,
          net_profit: fin.netProfit,
        };
      })
    );
  };

  const handleRecordBatchProgress = (payload: {
    boardId: string;
    remainingHoles: number;
    addedCashRevenue: number;
    newlyClaimedNumbers: number[];
    note: string;
  }) => {
    const nowIso = new Date().toISOString();
    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== payload.boardId) return b;

        const nextPrizes = b.prizes.map((p) => {
          if (payload.newlyClaimedNumbers.includes(p.number_label)) {
            return {
              ...p,
              is_claimed: true,
              claimed_at: p.claimed_at || nowIso,
            };
          }
          return p;
        });

        const nextGross =
          b.gross_coin_revenue + (Number(payload.addedCashRevenue) || 0);
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          nextGross,
          nextPrizes
        );

        const newLog = {
          check_id: `chk_${Date.now()}`,
          logged_at: nowIso,
          remaining_holes: payload.remainingHoles,
          newly_claimed_numbers: payload.newlyClaimedNumbers,
          recorded_cash_added: Number(payload.addedCashRevenue) || 0,
          note: payload.note,
        };

        return {
          ...b,
          remaining_holes: payload.remainingHoles,
          prizes: nextPrizes,
          gross_coin_revenue: fin.grossCoinRevenue,
          total_cashback_deducted: fin.totalCashbackDeducted,
          net_coin_revenue: fin.netCoinRevenue,
          total_prize_cost: fin.claimedPrizeCost,
          net_profit: fin.netProfit,
          check_logs: [newLog, ...b.check_logs],
        };
      })
    );

    showToast(`已更新：剩 ${payload.remainingHoles} 洞`);
  };

  const handleUpdateGrossRevenue = (
    boardId: string,
    newGrossRevenue: number
  ) => {
    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== boardId) return b;
        const fin = calculateScratchBoardFinancials(
          b.board_cost,
          newGrossRevenue,
          b.prizes
        );
        return {
          ...b,
          gross_coin_revenue: fin.grossCoinRevenue,
          total_cashback_deducted: fin.totalCashbackDeducted,
          net_coin_revenue: fin.netCoinRevenue,
          total_prize_cost: fin.claimedPrizeCost,
          net_profit: fin.netProfit,
        };
      })
    );
    showToast('已更新收幣金額');
  };

  const handleSettleBoard = (boardId: string) => {
    const nowIso = new Date().toISOString();
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    if (!targetBoard) return;

    setScratchBoards((prev) =>
      prev.map((b) =>
        b.board_id === boardId
          ? {
              ...b,
              status: 'SETTLED',
              settled_at: nowIso,
              remaining_holes: 0,
            }
          : b
      )
    );

    setMachines((prev) =>
      prev.map((m) => {
        if (m.machine_id !== targetBoard.machine_id) return m;
        if (m.active_board_id === boardId) {
          const nextActive = scratchBoards.find(
            (b) =>
              b.machine_id === m.machine_id &&
              b.board_id !== boardId &&
              b.status === 'ACTIVE'
          );
          return {
            ...m,
            active_board_id: nextActive ? nextActive.board_id : null,
          };
        }
        return m;
      })
    );

    showToast(`已下版結算「${targetBoard.title}」`);
  };

  const handleAddMachine = (
    newMachine: Omit<Machine, 'machine_id' | 'last_read_at'>
  ) => {
    const created: Machine = {
      ...newMachine,
      machine_id: `m_${Date.now()}`,
      last_read_at: new Date().toISOString(),
    };
    setMachines((prev) => [...prev, created]);
    showToast(`已新增 [${created.code}]`);
  };

  const handleDeleteMachine = (machineId: string) => {
    const target = machines.find((m) => m.machine_id === machineId);
    if (!target) return;

    // 1. 刪除機台本體
    setMachines((prev) => prev.filter((m) => m.machine_id !== machineId));

    // 2. 刪除該機台的所有抄錶/收幣紀錄
    setReadings((prev) => prev.filter((r) => r.machine_id !== machineId));

    // 3. 刪除綁定在該機台的所有刮刮樂看板
    setScratchBoards((prev) => prev.filter((b) => b.machine_id !== machineId));

    // 4. 清除綁定在該機台的專屬開銷
    setExpenses((prev) => prev.filter((e) => e.machine_id !== machineId));

    // 5. 將原本放置在該機台的庫存物品移回倉庫備品 (IN_STOCK)
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.machine_id === machineId
          ? {
              ...item,
              placement: 'IN_STOCK',
              machine_id: null,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    showToast(`已徹底刪除機台 [${target.code}] 及其所有關聯數據`);
  };

  // 1. 傳統滾輪二手錶底數校準設定
  const handleCalibrateMachineCounters = (
    machineId: string,
    initialCoinCounter: number,
    initialPrizeCounter: number
  ) => {
    const target = machines.find((m) => m.machine_id === machineId);
    if (!target) return;

    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === machineId
          ? {
              ...m,
              initial_coin_counter: initialCoinCounter,
              initial_prize_counter: initialPrizeCounter,
              last_coin_counter: initialCoinCounter,
              last_prize_counter: initialPrizeCounter,
              last_read_at: new Date().toISOString(),
            }
          : m
      )
    );
    showToast(`[${target.code}] 滾輪底數已校準 (幣:${initialCoinCounter.toLocaleString()} / 出:${initialPrizeCounter.toLocaleString()})`);
  };

  // 2. 整個 App 一鍵初始化（全部資料清空歸零）
  const handleResetEntireApp = () => {
    setMachines([]);
    setReadings([]);
    setScratchBoards([]);
    setInventoryItems([]);
    setExpenses([]);
    setCategories(INITIAL_CATEGORIES);

    Object.values(STORAGE_KEYS).forEach((k) => {
      localStorage.removeItem(k);
    });

    showToast('系統已完全初始化，所有資料已清空歸零！');
  };

  // 5. 台租頁面其他固定費用項目管理
  const handleUpdateMachineCustomFees = (
    machineId: string,
    fees: MachineCustomFee[]
  ) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === machineId ? { ...m, custom_fixed_fees: fees } : m
      )
    );
    showToast('已更新機台固定費用項目');
  };

  // 6. 台租定期付款紀錄與繳租日設定
  const handleRecordMachinePayment = (
    machineId: string,
    payment: Omit<MachinePaymentRecord, 'payment_id' | 'paid_at'>
  ) => {
    const newRecord: MachinePaymentRecord = {
      ...payment,
      payment_id: `pay_${Date.now()}`,
      paid_at: new Date().toISOString(),
    };
    setMachines((prev) =>
      prev.map((m) => {
        if (m.machine_id !== machineId) return m;
        const currentRecords = m.payment_records || [];
        return {
          ...m,
          payment_records: [newRecord, ...currentRecords],
        };
      })
    );
    showToast(`已記錄「${payment.title}」已付款 $${payment.amount.toLocaleString()}`);
  };

  const handleUpdateMachineRentPayDay = (machineId: string, payDay: number) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === machineId ? { ...m, rent_pay_day: payDay } : m
      )
    );
    showToast(`已設定每月 ${payDay} 號為繳租日`);
  };

  // 8. 匯入備份 JSON
  const handleImportJSON = (
    jsonData: any,
    mode: 'OVERWRITE' | 'MERGE' = 'OVERWRITE'
  ) => {
    try {
      if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('檔案格式錯誤，必須為有效的 JSON 物件');
      }

      if (mode === 'OVERWRITE') {
        if (Array.isArray(jsonData.machines)) setMachines(jsonData.machines);
        if (Array.isArray(jsonData.readings)) setReadings(jsonData.readings);
        if (Array.isArray(jsonData.scratchBoards))
          setScratchBoards(jsonData.scratchBoards);
        if (Array.isArray(jsonData.inventoryItems))
          setInventoryItems(jsonData.inventoryItems);
        if (Array.isArray(jsonData.expenses)) setExpenses(jsonData.expenses);
        if (Array.isArray(jsonData.categories))
          setCategories(jsonData.categories);
        showToast('備份資料已成功完整覆蓋還原！');
      } else {
        if (Array.isArray(jsonData.machines)) {
          setMachines((prev) => {
            const existingIds = new Set(prev.map((m) => m.machine_id));
            const newOnes = jsonData.machines.filter(
              (m: Machine) => !existingIds.has(m.machine_id)
            );
            return [...prev, ...newOnes];
          });
        }
        if (Array.isArray(jsonData.readings)) {
          setReadings((prev) => {
            const existingIds = new Set(prev.map((r) => r.reading_id));
            const newOnes = jsonData.readings.filter(
              (r: MeterReading) => !existingIds.has(r.reading_id)
            );
            return [...prev, ...newOnes];
          });
        }
        if (Array.isArray(jsonData.scratchBoards)) {
          setScratchBoards((prev) => {
            const existingIds = new Set(prev.map((b) => b.board_id));
            const newOnes = jsonData.scratchBoards.filter(
              (b: ScratchBoard) => !existingIds.has(b.board_id)
            );
            return [...prev, ...newOnes];
          });
        }
        if (Array.isArray(jsonData.inventoryItems)) {
          setInventoryItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.item_id));
            const newOnes = jsonData.inventoryItems.filter(
              (i: InventoryItem) => !existingIds.has(i.item_id)
            );
            return [...prev, ...newOnes];
          });
        }
        if (Array.isArray(jsonData.expenses)) {
          setExpenses((prev) => {
            const existingIds = new Set(prev.map((e) => e.expense_id));
            const newOnes = jsonData.expenses.filter(
              (e: Expense) => !existingIds.has(e.expense_id)
            );
            return [...prev, ...newOnes];
          });
        }
        showToast('備份資料已成功合併入系統！');
      }
    } catch (err: any) {
      showToast(`匯入失敗：${err?.message || '檔案格式不符'}`);
    }
  };

  const handleSwitchMachineModel = (machineId: string, model: MachineModel) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === machineId ? { ...m, machine_model: model } : m
      )
    );
  };

  const handleAddCategory = (newCat: string) => {
    if (categories.includes(newCat)) return;
    setCategories((prev) => [...prev, newCat]);
    showToast(`已新增「${newCat}」`);
  };

  const handleAddItem = (
    payload: Omit<InventoryItem, 'item_id' | 'updated_at'>
  ) => {
    const created: InventoryItem = {
      ...payload,
      item_id: `inv_${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    setInventoryItems((prev) => [created, ...prev]);
    showToast(`已新增「${created.name}」`);
  };

  const handleMoveItemPlacement = (
    itemId: string,
    targetPlacement: ItemPlacement,
    targetMachineId: string | null
  ) => {
    const nowIso = new Date().toISOString();
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? {
              ...item,
              placement: targetPlacement,
              machine_id:
                targetPlacement === 'ON_MACHINE' ? targetMachineId : null,
              updated_at: nowIso,
            }
          : item
      )
    );

    const targetMachine = machines.find(
      (m) => m.machine_id === targetMachineId
    );
    showToast(
      targetPlacement === 'IN_STOCK'
        ? '已移回倉庫'
        : `已移至 [${targetMachine?.code || '機台'}]`
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setInventoryItems((prev) => prev.filter((i) => i.item_id !== itemId));
    showToast('已刪除');
  };

  const handleUpdateMachineFixedCosts = (
    machineId: string,
    updates: Pick<Machine, 'rent_monthly' | 'other_fixed_fee' | 'other_fee_note'>
  ) => {
    setMachines((prev) =>
      prev.map((m) => (m.machine_id === machineId ? { ...m, ...updates } : m))
    );
    showToast('已儲存台租設定');
  };

  const handleAddExpense = (payload: Omit<Expense, 'expense_id'>) => {
    const created: Expense = {
      ...payload,
      expense_id: `exp_${Date.now()}`,
    };
    setExpenses((prev) => [created, ...prev]);
    showToast(`已新增：${created.title}`);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.expense_id !== expenseId));
    showToast('已刪除');
  };

  const handleExportCSV = () => {
    const headers = [
      '時間',
      '機台代號',
      '機台名稱',
      '模式',
      '清0類型',
      '面板收幣金額',
      '備註',
    ];
    const rows = readings.map((r) => {
      const m = machines.find((mc) => mc.machine_id === r.machine_id);
      return [
        r.read_at,
        m?.code || '',
        m?.name || '',
        r.entry_mode,
        r.clear_action,
        r.cash_collected,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clawops_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      machines,
      categories,
      inventoryItems,
      scratchBoards,
      readings,
      expenses,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clawops_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetDemoData = () => {
    setMachines(INITIAL_MACHINES);
    setCategories(INITIAL_CATEGORIES);
    setInventoryItems(INITIAL_INVENTORY);
    setReadings(INITIAL_READINGS);
    setScratchBoards(INITIAL_SCRATCH_BOARDS);
    setExpenses(INITIAL_EXPENSES);
    showToast('已重置範例資料');
  };

  const topStats = useMemo(() => {
    const overhead = calculateSimpleOverhead(machines, expenses, 'ALL');

    let boardNetCoin = 0;
    let boardPrizeCost = 0;
    scratchBoards.forEach((b) => {
      const fin = calculateScratchBoardFinancials(
        b.board_cost,
        b.gross_coin_revenue,
        b.prizes
      );
      boardNetCoin += fin.netCoinRevenue;
      boardPrizeCost += fin.claimedPrizeCost + (Number(b.board_cost) || 0);
    });

    const standaloneCoin = readings
      .filter((r) => !r.board_id)
      .reduce((s, r) => s + (Number(r.cash_collected) || 0), 0);

    const netRevenue = boardNetCoin + standaloneCoin;
    const trueNetProfit =
      netRevenue - boardPrizeCost - overhead.grandTotalOverhead;

    return {
      netRevenue,
      trueNetProfit,
    };
  }, [machines, scratchBoards, readings, expenses]);

  const NAV_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'meter', label: '收幣', icon: <Gauge className="w-4 h-4" /> },
    { key: 'scratch', label: '刮板', icon: <Grid className="w-4 h-4" /> },
    { key: 'inventory', label: '庫存', icon: <Package className="w-4 h-4" /> },
    { key: 'overhead', label: '台租', icon: <Wrench className="w-4 h-4" /> },
    { key: 'analytics', label: '損益', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col pb-28 md:pb-6">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0F17]/95 backdrop-blur border-b border-[#1E293B] pt-safe">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-white">
              ClawOps
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1E293B]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === item.key
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Compact Profit Pill */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-[10px] text-slate-400 leading-none">實收</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                ${topStats.netRevenue.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 leading-none">淨利</div>
              <div
                className={`text-xs font-mono font-bold ${
                  topStats.trueNetProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {topStats.trueNetProfit >= 0 ? '+' : ''}$
                {topStats.trueNetProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-4 py-2 rounded-full font-extrabold text-xs shadow-xl whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* Mobile-First Centered Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3.5 py-4">
        <ErrorBoundary>
        {activeTab === 'meter' && (
          <MeterTrackingView
            machines={machines}
            readings={readings}
            scratchBoards={scratchBoards}
            onSaveReading={handleSaveReading}
            onQuickMountBoard={handleQuickMountBoard}
            onAddMachine={handleAddMachine}
            onDeleteMachine={handleDeleteMachine}
            onCalibrateCounters={handleCalibrateMachineCounters}
            onSwitchMachineModel={handleSwitchMachineModel}
            onJumpToScratchBoard={() => setActiveTab('scratch')}
            onSettleBoard={handleSettleBoard}
          />
        )}

        {activeTab === 'scratch' && (
          <ScratchBoardView
            boards={scratchBoards}
            machines={machines}
            inventoryItems={inventoryItems}
            onQuickMountBoard={handleQuickMountBoard}
            onAddPrizeToBoard={handleAddPrizeToBoard}
            onTogglePrizeClaimed={handleTogglePrizeClaimed}
            onDeletePrizeFromBoard={handleDeletePrizeFromBoard}
            onRecordBatchProgress={handleRecordBatchProgress}
            onUpdateGrossRevenue={handleUpdateGrossRevenue}
            onSettleBoard={handleSettleBoard}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            items={inventoryItems}
            categories={categories}
            machines={machines}
            onAddCategory={handleAddCategory}
            onAddItem={handleAddItem}
            onMoveItemPlacement={handleMoveItemPlacement}
            onDeleteItem={handleDeleteItem}
          />
        )}

        {activeTab === 'overhead' && (
          <OverheadExpensesView
            machines={machines}
            expenses={expenses}
            onUpdateMachineFixedCosts={handleUpdateMachineFixedCosts}
            onUpdateMachineCustomFees={handleUpdateMachineCustomFees}
            onRecordMachinePayment={handleRecordMachinePayment}
            onUpdateMachineRentPayDay={handleUpdateMachineRentPayDay}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onDeleteMachine={handleDeleteMachine}
          />
        )}

        {activeTab === 'analytics' && (
          <FinancialAnalyticsView
            machines={machines}
            readings={readings}
            scratchBoards={scratchBoards}
            inventoryItems={inventoryItems}
            expenses={expenses}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onResetDemoData={handleResetDemoData}
            onResetEntireApp={handleResetEntireApp}
          />
        )}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111827]/95 backdrop-blur border-t border-[#1E293B] px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)]">
        <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {item.icon}
                <span className="text-[11px] mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
