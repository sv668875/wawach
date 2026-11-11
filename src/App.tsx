import React, { useState, useEffect, useMemo } from 'react';
import {
  Gauge,
  Grid,
  Package,
  Wrench,
  BarChart3,
  Cpu,
  RotateCcw,
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
  SettleBoardPayload,
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

interface UndoSnapshot {
  id: string;
  description: string;
  timestamp: string;
  state: {
    machines: Machine[];
    scratchBoards: ScratchBoard[];
    readings: MeterReading[];
    inventoryItems: InventoryItem[];
    expenses: Expense[];
    categories: string[];
    activeMachineId: string;
  };
}

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

  // 全域同步機台選取（收幣、刮板、損益跨頁面同步鎖定同一機台）
  const [activeMachineId, setActiveMachineId] = useState<string>(
    () => machines[0]?.machine_id || ''
  );

  useEffect(() => {
    if (machines.length > 0 && !machines.some((m) => m.machine_id === activeMachineId)) {
      setActiveMachineId(machines[0].machine_id);
    }
  }, [machines, activeMachineId]);

  // 主題配色系統：暗 (dark, 當前風格)、中間值 (neutral, 護眼深藍灰)、亮 (light, 清爽純白)
  type AppTheme = 'dark' | 'neutral' | 'light';
  const [theme, setTheme] = useState<AppTheme>(
    () => (localStorage.getItem('wawach_theme') as AppTheme) || 'dark'
  );

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: AppTheme =
        prev === 'dark' ? 'neutral' : prev === 'neutral' ? 'light' : 'dark';
      localStorage.setItem('wawach_theme', next);
      showToast(
        next === 'light'
          ? '☀️ 已切換為明亮風格'
          : next === 'neutral'
          ? '🌤️ 已切換為柔和風格 (中間值)'
          : '🌙 已切換為暗黑風格'
      );
      return next;
    });
  };

  // 操作防呆與返回復原堆疊 (Undo stack)
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const pushUndo = (description: string) => {
    const snapshot: UndoSnapshot = {
      id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description,
      timestamp: new Date().toISOString(),
      state: {
        machines: JSON.parse(JSON.stringify(machines)),
        scratchBoards: JSON.parse(JSON.stringify(scratchBoards)),
        readings: JSON.parse(JSON.stringify(readings)),
        inventoryItems: JSON.parse(JSON.stringify(inventoryItems)),
        expenses: JSON.parse(JSON.stringify(expenses)),
        categories: [...categories],
        activeMachineId,
      },
    };
    // 支援至少 10+ 個步驟 (上限保留 30 步深度)
    setUndoStack((prev) => [snapshot, ...prev.slice(0, 29)]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setMachines(latest.state.machines);
    setScratchBoards(latest.state.scratchBoards);
    setReadings(latest.state.readings);
    setInventoryItems(latest.state.inventoryItems);
    setExpenses(latest.state.expenses);
    setCategories(latest.state.categories);
    if (latest.state.activeMachineId) {
      setActiveMachineId(latest.state.activeMachineId);
    }
    setUndoStack(rest);
    showToast(`↩️ 已復原：${latest.description}（還可復原 ${rest.length} 步）`);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [targetScratchBoardId, setTargetScratchBoardId] = useState<string | null>(null);

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
    pushUndo('記錄收幣');
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
        // 如果是結算下版，只清掉該特定版，若還有其他版則自動保留
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
        ? `[${targetMachine.code}] 結算下版 +$${cashAdded.toLocaleString()}`
        : `[${targetMachine.code}] 記錄收幣 +$${cashAdded.toLocaleString()}`
    );
  };

  const handleQuickMountBoard = (
    machineId: string,
    totalHoles: number,
    customTitle?: string
  ) => {
    pushUndo('上架新刮板');
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
    pushUndo('新增獎項');
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    const machineId = targetBoard?.machine_id || null;
    const targetMachine = machines.find((m) => m.machine_id === machineId);
    let assignedInvId = prizeInput.inventoryItemId;

    // 1. 若選擇倉庫備品 (prizeInput.inventoryItemId)：自倉庫移轉至該機台庫存，選項隨即排除不重覆
    if (prizeInput.inventoryItemId) {
      const warehouseItem = inventoryItems.find(
        (it) => it.item_id === prizeInput.inventoryItemId
      );
      if (warehouseItem) {
        if (warehouseItem.quantity <= 1) {
          // 數量僅 1 件：直接移轉為機台庫存 (ON_MACHINE)，倉庫備品中不再可選
          assignedInvId = warehouseItem.item_id;
          setInventoryItems((prev) =>
            prev.map((it) => {
              if (it.item_id !== warehouseItem.item_id) return it;
              return {
                ...it,
                placement: 'ON_MACHINE',
                machine_id: machineId,
                note: `自倉庫移轉至 [${targetMachine?.code || '機台'}] 刮板 #${prizeInput.numberLabel}`,
                updated_at: new Date().toISOString(),
              };
            })
          );
        } else {
          // 數量 > 1 件：倉庫扣除 1 件，並獨立新建 1 件機台庫存
          const newMachineInvId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          assignedInvId = newMachineInvId;
          const newOnMachineItem: InventoryItem = {
            item_id: newMachineInvId,
            name: warehouseItem.name,
            category: warehouseItem.category,
            acquisition_source: warehouseItem.acquisition_source,
            unit_cost: warehouseItem.unit_cost,
            quantity: 1,
            placement: 'ON_MACHINE',
            machine_id: machineId,
            note: `自倉庫備品分出 1 件移轉至 [${targetMachine?.code || '機台'}] 刮板 #${prizeInput.numberLabel}`,
            updated_at: new Date().toISOString(),
          };
          setInventoryItems((prev) => [
            newOnMachineItem,
            ...prev.map((it) => {
              if (it.item_id !== warehouseItem.item_id) return it;
              return {
                ...it,
                quantity: Math.max(0, it.quantity - 1),
                updated_at: new Date().toISOString(),
              };
            }),
          ]);
        }
        showToast(
          `已自倉庫帶入 #${prizeInput.numberLabel} ${warehouseItem.name} (已移轉至機台庫存)`
        );
      }
    } else if (
      prizeInput.syncToInventory &&
      prizeInput.prizeName &&
      prizeInput.prizeCost > 0
    ) {
      // 2. 做法 A：若勾選「同步登記為該機台庫存」，自動在庫存中建立 ON_MACHINE 商品 (方便統計壓貨資金)
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
      showToast(
        `已加入 #${prizeInput.numberLabel} 並登記至 [${targetMachine?.code || '機台'}] 庫存`
      );
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
    pushUndo('變更中獎狀態');
    const nowIso = new Date().toISOString();
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    const targetPrize = targetBoard?.prizes.find((p) => p.item_id === itemId);
    const willBeClaimed = !targetPrize?.is_claimed;

    const scratchedHolesSnapshot = targetBoard
      ? Math.max(0, targetBoard.total_holes - targetBoard.remaining_holes)
      : undefined;
    const revenueSnapshot = targetBoard?.gross_coin_revenue;

    // 當客人「拿獎」實體商品出貨時，若有綁定庫存品項，自動扣減庫存數量 1 件
    // 反之，若取消中獎且原為實體，則補回 1 件
    if (targetPrize?.inventory_item_id) {
      if (willBeClaimed && claimType === 'PHYSICAL') {
        setInventoryItems((prev) =>
          prev
            .map((item) => {
              if (item.item_id !== targetPrize.inventory_item_id) return item;
              return {
                ...item,
                quantity: Math.max(0, item.quantity - 1),
              };
            })
            .filter((item) => item.quantity > 0)
        );
      } else if (!willBeClaimed && targetPrize.claim_type === 'PHYSICAL') {
        setInventoryItems((prev) =>
          prev.map((item) => {
            if (item.item_id !== targetPrize.inventory_item_id) return item;
            return {
              ...item,
              quantity: item.quantity + 1,
            };
          })
        );
      }
    }

    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== boardId) return b;
        const nextPrizes = b.prizes.map((p) => {
          if (p.item_id !== itemId) return p;
          const chosenType = willBeClaimed
            ? claimType || (p.is_cashback && (!p.prize_cost || p.prize_cost === 0) ? 'CASHBACK' : 'PHYSICAL')
            : undefined;
          return {
            ...p,
            is_claimed: willBeClaimed,
            claim_type: chosenType,
            claimed_at: willBeClaimed ? nowIso : undefined,
            claimed_at_scratched_holes: willBeClaimed ? scratchedHolesSnapshot : undefined,
            claimed_at_revenue: willBeClaimed ? revenueSnapshot : undefined,
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
    pushUndo('取下獎項');
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    const targetPrize = targetBoard?.prizes.find((p) => p.item_id === itemId);

    // 若刪除/取下的獎項有對應的庫存 ID，將該庫存退回倉庫備品 (IN_STOCK)，重現於選單中
    if (targetPrize?.inventory_item_id) {
      setInventoryItems((prev) =>
        prev.map((it) => {
          if (it.item_id !== targetPrize.inventory_item_id) return it;
          return {
            ...it,
            placement: 'IN_STOCK',
            machine_id: null,
            note: `${it.note ? `${it.note} (取下退回倉庫)` : '取下退回倉庫'}`,
            updated_at: new Date().toISOString(),
          };
        })
      );
    }

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
    showToast(`已從刮板取下獎項 #${targetPrize?.number_label || ''}`);
  };

  const handleRecordBatchProgress = (payload: {
    boardId: string;
    remainingHoles: number;
    addedCashRevenue: number;
    newlyClaimedNumbers: number[];
    claimedPrizeDetails?: {
      number_label: number;
      claim_type: 'PHYSICAL' | 'CASHBACK';
    }[];
    newCoinCounter?: number;
    note: string;
  }) => {
    pushUndo('分批巡場紀錄');
    const nowIso = new Date().toISOString();
    const targetBoard = scratchBoards.find((b) => b.board_id === payload.boardId);
    if (!targetBoard) return;

    const scratchedHolesSnapshot = Math.max(
      0,
      targetBoard.total_holes - payload.remainingHoles
    );
    const nextGross =
      targetBoard.gross_coin_revenue + (Number(payload.addedCashRevenue) || 0);

    // 1. 若有勾選新開出實體獎項（拿獎 PHYSICAL），即時扣減機台庫存
    const physicalInvIdsToDeduct: string[] = [];
    if (payload.claimedPrizeDetails && payload.claimedPrizeDetails.length > 0) {
      payload.claimedPrizeDetails.forEach((detail) => {
        if (detail.claim_type === 'PHYSICAL') {
          const prize = targetBoard.prizes.find(
            (p) => p.number_label === detail.number_label
          );
          if (prize?.inventory_item_id && !prize.is_claimed) {
            physicalInvIdsToDeduct.push(prize.inventory_item_id);
          }
        }
      });
    }

    if (physicalInvIdsToDeduct.length > 0) {
      setInventoryItems((prev) =>
        prev
          .map((item) => {
            const count = physicalInvIdsToDeduct.filter((id) => id === item.item_id).length;
            if (count === 0) return item;
            return {
              ...item,
              quantity: Math.max(0, item.quantity - count),
            };
          })
          .filter((item) => item.quantity > 0)
      );
    }

    // 2. 更新刮板獎項資料（登記出獎時機洞數與累積幣量）
    setScratchBoards((prev) =>
      prev.map((b) => {
        if (b.board_id !== payload.boardId) return b;

        const nextPrizes = b.prizes.map((p) => {
          if (payload.newlyClaimedNumbers.includes(p.number_label)) {
            const detail = payload.claimedPrizeDetails?.find(
              (d) => d.number_label === p.number_label
            );
            const resolvedClaimType =
              detail?.claim_type ||
              p.claim_type ||
              (p.is_cashback && (!p.prize_cost || p.prize_cost === 0)
                ? 'CASHBACK'
                : 'PHYSICAL');

            return {
              ...p,
              is_claimed: true,
              claim_type: resolvedClaimType,
              claimed_at: p.claimed_at || nowIso,
              claimed_at_scratched_holes:
                p.claimed_at_scratched_holes ?? scratchedHolesSnapshot,
              claimed_at_revenue: p.claimed_at_revenue ?? nextGross,
            };
          }
          return p;
        });

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
          claimed_prize_details: payload.claimedPrizeDetails,
          cumulative_revenue_snapshot: nextGross,
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

    // 3. 若有傳入類比錶頭最新讀數，自動同步更新該機台之 last_coin_counter (免去重複打錶)
    if (typeof payload.newCoinCounter === 'number' && payload.newCoinCounter >= 0) {
      setMachines((prev) =>
        prev.map((m) =>
          m.machine_id === targetBoard.machine_id
            ? {
                ...m,
                last_coin_counter: payload.newCoinCounter!,
                last_read_at: nowIso,
              }
            : m
        )
      );
    }

    showToast(`已更新：剩 ${payload.remainingHoles} 洞 (巡場出幣 +$${Number(payload.addedCashRevenue || 0).toLocaleString()})`);
  };

  const handleUpdateGrossRevenue = (
    boardId: string,
    newGrossRevenue: number
  ) => {
    pushUndo('更新收幣金額');
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

  const handleSettleBoard = (payload: SettleBoardPayload | string) => {
    pushUndo('結算下版');
    const boardId = typeof payload === 'string' ? payload : payload.boardId;
    const finalCash =
      typeof payload === 'string'
        ? 0
        : Math.max(0, Number(payload.finalCollectedCash) || 0);
    const isAlreadyRecorded =
      typeof payload === 'string' ? false : !!payload.isCashAlreadyRecorded;
    const prizesAction =
      typeof payload === 'string'
        ? 'KEEP_ON_MACHINE'
        : payload.remainingPrizesAction || 'RETURN_TO_WAREHOUSE';
    const customNotes = typeof payload === 'string' ? '' : payload.notes || '';

    const nowIso = new Date().toISOString();
    const targetBoard = scratchBoards.find((b) => b.board_id === boardId);
    if (!targetBoard) return;

    const targetMachine = machines.find(
      (m) => m.machine_id === targetBoard.machine_id
    );

    // 1. 計算下版時剩餘洞數與實際被刮掉洞數（不再強制寫死 0 洞！）
    const settledRemHoles =
      typeof payload === 'string'
        ? targetBoard.remaining_holes
        : payload.settledRemainingHoles !== undefined
        ? Math.max(0, Number(payload.settledRemainingHoles))
        : targetBoard.remaining_holes;
    const settledScratchedHoles = Math.max(
      0,
      targetBoard.total_holes - settledRemHoles
    );

    // 2. 計算最終總收幣 (防呆：若先前已登記過，則不額外累加，避免二次記帳重複計算！)
    const addedCash = !isAlreadyRecorded && finalCash > 0 ? finalCash : 0;
    const finalGrossRevenue = targetBoard.gross_coin_revenue + addedCash;

    // 3. 計算平均每洞出資額 (均出 = 總幣量 / 實際刮掉洞數)
    const avgRevenuePerHole =
      settledScratchedHoles > 0
        ? Math.round(finalGrossRevenue / settledScratchedHoles)
        : 0;

    // 4. 重新計算該板最終損益
    const fin = calculateScratchBoardFinancials(
      targetBoard.board_cost,
      finalGrossRevenue,
      targetBoard.prizes || []
    );

    // 5. 更新看板狀態為 SETTLED 並存入最終結算數據與下版洞數
    setScratchBoards((prev) =>
      prev.map((b) =>
        b.board_id === boardId
          ? {
              ...b,
              status: 'SETTLED',
              settled_at: nowIso,
              remaining_holes: settledRemHoles,
              settled_remaining_holes: settledRemHoles,
              settled_scratched_holes: settledScratchedHoles,
              avg_revenue_per_hole: avgRevenuePerHole,
              gross_coin_revenue: fin.grossCoinRevenue,
              total_cashback_deducted: fin.totalCashbackDeducted,
              net_coin_revenue: fin.netCoinRevenue,
              total_prize_cost: fin.claimedPrizeCost,
              net_profit: fin.netProfit,
            }
          : b
      )
    );

    // 6. 若本次有收幣，自動建立一筆「結算下版 (BOARD_CLOSE_CLEAR)」紀錄
    // (確保收幣歷史有這筆紀錄，且 board_id 正確關聯，不會變成 standaloneCoin 造成二次重複計算！)
    if (finalCash > 0) {
      const coinUnit = targetMachine?.coin_unit_value || 10;
      const coinsDelta = Math.round(finalCash / coinUnit);
      const newReading: MeterReading = {
        reading_id: `read_${Date.now()}`,
        machine_id: targetBoard.machine_id,
        board_id: targetBoard.board_id,
        entry_mode: targetMachine?.machine_model || 'DIGITAL',
        clear_action: 'BOARD_CLOSE_CLEAR',
        read_at: nowIso,
        panel_amount: finalCash,
        cash_collected: finalCash,
        last_coin_counter: targetMachine?.last_coin_counter || 0,
        coin_counter: (targetMachine?.last_coin_counter || 0) + coinsDelta,
        last_prize_counter: targetMachine?.last_prize_counter || 0,
        prize_counter: targetMachine?.last_prize_counter || 0,
        reset_mode: 'NORMAL',
        coins_delta: coinsDelta,
        prizes_delta: 0,
        notes:
          customNotes.trim() ||
          `[${targetBoard.board_letter ? `${targetBoard.board_letter}板` : ''}結算下版] 實收 $${finalCash.toLocaleString()}`,
      };
      setReadings((prev) => [newReading, ...prev]);

      // 更新機台最新抄錶狀態
      setMachines((prev) =>
        prev.map((m) => {
          if (m.machine_id !== targetBoard.machine_id) return m;
          return {
            ...m,
            last_coin_counter: newReading.coin_counter,
            last_read_at: nowIso,
          };
        })
      );
    }

    // 7. 處理獎品去向：
    // 7.1 客人已領走實體商品（PHYSICAL）的獎項，正式出庫銷帳，不再計入機台壓貨成本
    const claimedPhysicalPrizes = (targetBoard.prizes || []).filter(
      (p) => p.is_claimed && p.claim_type === 'PHYSICAL'
    );
    const claimedInvIds = new Set(
      claimedPhysicalPrizes.map((p) => p.inventory_item_id).filter(Boolean)
    );
    if (claimedInvIds.size > 0) {
      setInventoryItems((prev) =>
        prev.filter((item) => !claimedInvIds.has(item.item_id))
      );
    }

    // 7.2 未被刮出或客人選擇折現回錢（實體未出）的獎品，若選擇退回倉庫
    if (prizesAction === 'RETURN_TO_WAREHOUSE') {
      const retainedPrizes = (targetBoard.prizes || []).filter(
        (p) => !p.is_claimed || p.claim_type === 'CASHBACK'
      );
      const returnInvIds = new Set(
        retainedPrizes.map((p) => p.inventory_item_id).filter(Boolean)
      );

      if (returnInvIds.size > 0) {
        setInventoryItems((prev) =>
          prev.map((item) => {
            if (returnInvIds.has(item.item_id)) {
              return {
                ...item,
                placement: 'IN_STOCK',
                machine_id: null,
                updated_at: nowIso,
                note: item.note ? `${item.note} (下版退回倉庫)` : '下版退回倉庫',
              };
            }
            return item;
          })
        );
      }
    }

    // 8. 機台看板交接：若該機台目前 active_board_id 為本板，自動切換至同一機台的其他進行中板次
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

    const profitSign = fin.netProfit >= 0 ? '+$' : '-$';
    const profitAbs = Math.abs(fin.netProfit).toLocaleString();
    showToast(
      `[${targetMachine?.code || '機台'}] ${targetBoard.title} 已完成下版結清！總收幣 $${fin.grossCoinRevenue.toLocaleString()}，均出 $${avgRevenuePerHole}/洞，淨利 ${profitSign}${profitAbs}`
    );
  };

  const handleAddMachine = (
    newMachine: Omit<Machine, 'machine_id' | 'last_read_at'>
  ) => {
    const trimmedCode = (newMachine.code || '').trim();
    if (!trimmedCode) {
      showToast('⚠️ 請輸入機台代號！');
      return;
    }
    const duplicate = machines.some(
      (m) => m.code.trim().toLowerCase() === trimmedCode.toLowerCase()
    );
    if (duplicate) {
      showToast(`⚠️ 機台代號 [${trimmedCode}] 已存在，請使用不同代號！`);
      return;
    }

    pushUndo(`新增機台 [${trimmedCode}]`);
    const created: Machine = {
      ...newMachine,
      code: trimmedCode,
      machine_id: `m_${Date.now()}`,
      last_read_at: new Date().toISOString(),
    };
    setMachines((prev) => [...prev, created]);
    setActiveMachineId(created.machine_id);
    showToast(`已新增機台 [${created.code}]`);
  };

  const handleDeleteMachine = (machineId: string) => {
    const target = machines.find((m) => m.machine_id === machineId);
    if (!target) return;

    pushUndo(`刪除機台 [${target.code}]`);
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

    pushUndo(`校準 [${target.code}] 滾輪計數`);
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

  // 1.5. 刪除手誤抄錶紀錄 (自動回退機台底數至前一筆)
  const handleDeleteReading = (readingId: string) => {
    const targetReading = readings.find((r) => r.reading_id === readingId);
    if (!targetReading) return;
    pushUndo(`刪除收幣紀錄 (+$${targetReading.cash_collected.toLocaleString()})`);

    const remainingReadings = readings.filter((r) => r.reading_id !== readingId);
    setReadings(remainingReadings);

    // 如果刪除的紀錄是該機台的最新抄錶，自動回退上次計數器
    const machineRemaining = remainingReadings.filter(
      (r) => r.machine_id === targetReading.machine_id
    );
    if (machineRemaining.length > 0) {
      const prevLatest = machineRemaining[0];
      setMachines((prev) =>
        prev.map((m) =>
          m.machine_id === targetReading.machine_id
            ? {
                ...m,
                last_coin_counter: prevLatest.coin_counter,
                last_prize_counter: prevLatest.prize_counter,
                last_read_at: prevLatest.read_at,
              }
            : m
        )
      );
    } else {
      // 若該機台已無任何抄錶紀錄，回退至起始底數
      setMachines((prev) =>
        prev.map((m) =>
          m.machine_id === targetReading.machine_id
            ? {
                ...m,
                last_coin_counter: m.initial_coin_counter ?? 0,
                last_prize_counter: m.initial_prize_counter ?? 0,
              }
            : m
        )
      );
    }

    showToast(`已刪除收幣紀錄 (已自動校準機台讀數)`);
  };

  // 1.6. 微調商品庫存數量
  const handleUpdateItemQuantity = (itemId: string, newQuantity: number) => {
    const target = inventoryItems.find((i) => i.item_id === itemId);
    if (!target) return;
    const safeQty = Math.max(0, Math.floor(newQuantity));
    pushUndo(`更新「${target.name}」數量為 ${safeQty} 件`);
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? { ...item, quantity: safeQty, updated_at: new Date().toISOString() }
          : item
      )
    );
    showToast(`「${target.name}」數量已更新為 ${safeQty} 件`);
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
    pushUndo('更新機台固定費用');
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
    pushUndo(`記錄付款「${payment.title}」`);
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
    pushUndo(`修改繳租日為每月 ${payDay} 號`);
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
    pushUndo(`切換機台模式為 ${model === 'ANALOG' ? '傳統類比' : '數位'}`);
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
    pushUndo(`新增商品「${payload.name}」`);
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
    pushUndo('變更庫存存放位置');
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
    const targetItem = inventoryItems.find((i) => i.item_id === itemId);
    pushUndo(`刪除商品「${targetItem?.name || ''}」`);
    setInventoryItems((prev) => prev.filter((i) => i.item_id !== itemId));
    showToast('已刪除');
  };

  const handleUpdateMachineFixedCosts = (
    machineId: string,
    updates: Pick<Machine, 'rent_monthly' | 'other_fixed_fee' | 'other_fee_note'>
  ) => {
    pushUndo('修改台租費用');
    setMachines((prev) =>
      prev.map((m) => (m.machine_id === machineId ? { ...m, ...updates } : m))
    );
    showToast('已儲存台租設定');
  };

  const handleAddExpense = (payload: Omit<Expense, 'expense_id'>) => {
    pushUndo(`新增開銷「${payload.title}」`);
    const created: Expense = {
      ...payload,
      expense_id: `exp_${Date.now()}`,
    };
    setExpenses((prev) => [created, ...prev]);
    showToast(`已新增：${created.title}`);
  };

  const handleDeleteExpense = (expenseId: string) => {
    const targetExpense = expenses.find((e) => e.expense_id === expenseId);
    pushUndo(`刪除開銷「${targetExpense?.title || ''}」`);
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
    <div className={`min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col pb-28 md:pb-6 theme-${theme} transition-colors duration-200`}>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0F17]/95 backdrop-blur border-b border-[#1E293B] pt-safe transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Brand & Undo Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-white">
              ClawOps
            </span>
            {undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="min-h-[36px] h-9 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/35 text-amber-400 border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 touch-manipulation"
                title={`復原：${undoStack[0].description}（可復原 ${undoStack.length} 個步驟）`}
                aria-label="復原上一步"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-bold hidden sm:inline">復原</span>
                <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full leading-none">
                  {undoStack.length}
                </span>
              </button>
            )}
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

          {/* Compact Profit Pill + Theme Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 text-right">
            <div>
              <div className="text-[11px] text-slate-400 leading-none">實收</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                ${topStats.netRevenue.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 leading-none">淨利</div>
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

            {/* 3 種風格切換按鈕 (亮 / 中間值 / 暗) */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="h-8 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shrink-0 shadow-sm"
              title={`目前風格：${theme === 'dark' ? '暗黑科技 (當前)' : theme === 'neutral' ? '柔和深灰 (中間值)' : '純淨明亮 (亮色)'}（點擊切換）`}
            >
              {theme === 'dark' && (
                <>
                  <span className="text-xs">🌙</span>
                  <span className="text-[10px] font-bold hidden sm:inline">暗</span>
                </>
              )}
              {theme === 'neutral' && (
                <>
                  <span className="text-xs">🌤️</span>
                  <span className="text-[10px] font-bold hidden sm:inline text-sky-300">中</span>
                </>
              )}
              {theme === 'light' && (
                <>
                  <span className="text-xs">☀️</span>
                  <span className="text-[10px] font-bold hidden sm:inline text-amber-500">亮</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Toast 提示浮窗 (整合快捷復原按鈕) */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-[#111827] border border-emerald-500/50 text-white pl-4 pr-2 py-1.5 rounded-2xl font-bold text-xs shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <span className="text-emerald-400 font-semibold truncate">{toastMessage}</span>
          {undoStack.length > 0 && !toastMessage.startsWith('↩️') && (
            <button
              type="button"
              onClick={handleUndo}
              className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0 active:scale-95 transition-all touch-manipulation shadow-sm"
              title="立即復原剛才的操作"
            >
              <RotateCcw className="w-3 h-3" />
              <span>復原</span>
            </button>
          )}
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
            selectedMachineId={activeMachineId}
            onSelectMachine={setActiveMachineId}
            onSaveReading={handleSaveReading}
            onQuickMountBoard={handleQuickMountBoard}
            onAddMachine={handleAddMachine}
            onDeleteMachine={handleDeleteMachine}
            onCalibrateCounters={handleCalibrateMachineCounters}
            onSwitchMachineModel={handleSwitchMachineModel}
            onDeleteReading={handleDeleteReading}
            onJumpToScratchBoard={(boardId) => {
              if (boardId) setTargetScratchBoardId(boardId);
              setActiveTab('scratch');
            }}
          />
        )}

        {activeTab === 'scratch' && (
          <ScratchBoardView
            boards={scratchBoards}
            machines={machines}
            inventoryItems={inventoryItems}
            activeMachineId={activeMachineId}
            onSelectMachine={setActiveMachineId}
            targetBoardId={targetScratchBoardId}
            onTargetBoardConsumed={() => setTargetScratchBoardId(null)}
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
            onUpdateItemQuantity={handleUpdateItemQuantity}
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
            activeMachineId={activeMachineId}
            onSelectMachine={setActiveMachineId}
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
