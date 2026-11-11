import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  ArrowRightLeft,
  FolderPlus,
  Trash2,
  Cpu,
  Archive,
  X,
} from 'lucide-react';
import {
  AcquisitionSource,
  InventoryItem,
  ItemPlacement,
  Machine,
} from '../types';

interface InventoryViewProps {
  items: InventoryItem[];
  categories: string[];
  machines: Machine[];
  onAddCategory: (newCat: string) => void;
  onAddItem: (payload: Omit<InventoryItem, 'item_id' | 'updated_at'>) => void;
  onMoveItemPlacement: (
    itemId: string,
    targetPlacement: ItemPlacement,
    targetMachineId: string | null
  ) => void;
  onDeleteItem: (itemId: string) => void;
}

const ACQUISITION_SOURCES: AcquisitionSource[] = [
  '採購',
  '全新',
  '二手',
  '打台',
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  categories,
  machines,
  onAddCategory,
  onAddItem,
  onMoveItemPlacement,
  onDeleteItem,
}) => {
  // 兩個小巧子分頁按鈕：機台庫存 vs 倉庫庫存
  const [placementTab, setPlacementTab] = useState<ItemPlacement>('ON_MACHINE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<'ALL' | AcquisitionSource>('ALL');

  // 彈窗控制：新增貨物 / 新增類別
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAddingCat, setIsAddingCat] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // 新增貨物表單
  const [itemName, setItemName] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>(categories[0] || '公仔');
  const [isAddingNewCatInModal, setIsAddingNewCatInModal] = useState<boolean>(false);
  const [newCatInModalName, setNewCatInModalName] = useState<string>('');
  const [itemSource, setItemSource] = useState<AcquisitionSource>('採購');
  const [itemCost, setItemCost] = useState<number>(350);
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemTargetPlacement, setItemTargetPlacement] = useState<ItemPlacement>('IN_STOCK');
  const [itemTargetMachineId, setItemTargetMachineId] = useState<string>(
    machines[0]?.machine_id || ''
  );

  const onMachineItems = useMemo(
    () => items.filter((i) => i.placement === 'ON_MACHINE'),
    [items]
  );
  const inStockItems = useMemo(
    () => items.filter((i) => i.placement === 'IN_STOCK'),
    [items]
  );

  const displayedItems = useMemo(() => {
    const base = placementTab === 'ON_MACHINE' ? onMachineItems : inStockItems;
    return base.filter((item) => {
      const matchCat =
        selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchSource =
        selectedSource === 'ALL' || item.acquisition_source === selectedSource;
      return matchCat && matchSource;
    });
  }, [placementTab, onMachineItems, inStockItems, selectedCategory, selectedSource]);

  const totalOnMachineValue = useMemo(
    () => onMachineItems.reduce((s, i) => s + i.unit_cost * i.quantity, 0),
    [onMachineItems]
  );
  const totalInStockValue = useMemo(
    () => inStockItems.reduce((s, i) => s + i.unit_cost * i.quantity, 0),
    [inStockItems]
  );
  const grandTotalValue = totalOnMachineValue + totalInStockValue;
  const onMachineQuantity = useMemo(
    () => onMachineItems.reduce((s, i) => s + i.quantity, 0),
    [onMachineItems]
  );
  const inStockQuantity = useMemo(
    () => inStockItems.reduce((s, i) => s + i.quantity, 0),
    [inStockItems]
  );
  const totalQuantity = onMachineQuantity + inStockQuantity;
  const onMachinePct =
    grandTotalValue > 0
      ? Math.round((totalOnMachineValue / grandTotalValue) * 100)
      : 50;
  const inStockPct = Math.max(0, 100 - onMachinePct);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    setItemCategory(trimmed);
    setNewCategoryName('');
    setIsAddingCat(false);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    let finalCategory = itemCategory;
    if (isAddingNewCatInModal && newCatInModalName.trim()) {
      finalCategory = newCatInModalName.trim();
      onAddCategory(finalCategory);
    } else if (!finalCategory || finalCategory === '__NEW_CATEGORY__') {
      finalCategory = categories[0] || '未分類';
    }

    onAddItem({
      name: itemName.trim(),
      category: finalCategory,
      acquisition_source: itemSource,
      unit_cost: Math.max(0, Number(itemCost) || 0),
      quantity: Math.max(1, Number(itemQty) || 1),
      placement: itemTargetPlacement,
      machine_id:
        itemTargetPlacement === 'ON_MACHINE'
          ? itemTargetMachineId || machines[0]?.machine_id || null
          : null,
      note: '',
    });

    setItemName('');
    setItemQty(1);
    setNewCatInModalName('');
    setIsAddingNewCatInModal(false);
    setPlacementTab(itemTargetPlacement);
    setIsAddModalOpen(false);
  };

  const handleInstantDestinationChange = (item: InventoryItem, destValue: string) => {
    if (destValue === 'IN_STOCK') {
      onMoveItemPlacement(item.item_id, 'IN_STOCK', null);
    } else if (destValue.startsWith('MACHINE:')) {
      const mId = destValue.replace('MACHINE:', '');
      onMoveItemPlacement(item.item_id, 'ON_MACHINE', mId);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 頂部列：兩個小巧子分頁按鈕 (機台庫存 / 倉庫庫存) + 新增按鈕 */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center bg-[#111827] border border-[#1E293B] rounded-xl p-1">
          <button
            type="button"
            onClick={() => setPlacementTab('ON_MACHINE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              placementTab === 'ON_MACHINE'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            機台庫存
            <span className="font-mono text-[11px] opacity-80">
              ({onMachineItems.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPlacementTab('IN_STOCK')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              placementTab === 'IN_STOCK'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            倉庫庫存
            <span className="font-mono text-[11px] opacity-80">
              ({inStockItems.length})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setItemTargetPlacement(placementTab);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs whitespace-nowrap shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新增貨物
        </button>
      </div>

      {/* 2. 庫存壓貨資金與資產總覽統計卡 (完整統計所有庫存、機台庫存、倉庫庫存壓貨金額) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-4 space-y-3.5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">庫存資產</div>
              <div className="text-[10px] text-slate-400">在庫與機台商品總值</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">總壓貨資金</div>
            <div className="text-lg font-mono font-black text-amber-400">
              ${grandTotalValue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 3 格核心壓貨金額與數量 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* 總件數 */}
          <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-slate-800 space-y-0.5">
            <div className="text-[10px] text-slate-400">總件數</div>
            <div className="text-sm font-mono font-black text-white">
              {totalQuantity} <span className="text-[10px] font-normal text-slate-400">件</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {items.length} 品項
            </div>
          </div>

          {/* 機台在台壓貨 */}
          <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-slate-800 space-y-0.5">
            <div className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1">
              <Cpu className="w-3 h-3" /> 機台壓貨
            </div>
            <div className="text-sm font-mono font-black text-amber-400">
              ${totalOnMachineValue.toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {onMachineQuantity} 件 ({onMachinePct}%)
            </div>
          </div>

          {/* 倉庫備品壓貨 */}
          <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-slate-800 space-y-0.5">
            <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
              <Archive className="w-3 h-3" /> 倉庫壓貨
            </div>
            <div className="text-sm font-mono font-black text-emerald-400">
              ${totalInStockValue.toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {inStockQuantity} 件 ({inStockPct}%)
            </div>
          </div>
        </div>

        {/* 貨值比重進度條 */}
        <div className="space-y-1">
          <div className="w-full h-2 bg-[#0B0F17] rounded-full overflow-hidden flex border border-slate-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${onMachinePct}%` }}
              title="機台在台"
            />
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${inStockPct}%` }}
              title="倉庫備品"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="text-amber-400/90 font-medium">● 機台在台壓貨 {onMachinePct}%</span>
            <span className="text-emerald-400/90 font-medium">● 倉庫備品壓貨 {inStockPct}%</span>
          </div>
        </div>
      </div>

      {/* 3. 類別與來源橫向快篩 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-slate-200 text-slate-950'
                : 'bg-[#111827] text-slate-400 border border-[#1E293B]'
            }`}
          >
            全部類別
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-slate-200 text-slate-950'
                  : 'bg-[#111827] text-slate-400 border border-[#1E293B]'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsAddingCat(!isAddingCat)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#111827] text-amber-400 border border-amber-500/30 whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            +類別
          </button>
        </div>

        {isAddingCat && (
          <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="輸入新類別名稱..."
              className="flex-1 bg-[#111827] border border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs whitespace-nowrap"
            >
              新增
            </button>
          </form>
        )}

        {/* 獲取方式快篩：採購 / 全新 / 二手 / 打台 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedSource('ALL')}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
              selectedSource === 'ALL'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-[#111827] text-slate-500 border border-[#1E293B]'
            }`}
          >
            全部來源
          </button>
          {ACQUISITION_SOURCES.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelectedSource(src)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                selectedSource === src
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#111827] text-slate-500 border border-[#1E293B]'
              }`}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 貨物卡片清單 (手機友善排版，一鍵移轉位置) */}
      {displayedItems.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-10 text-center text-xs text-slate-500">
          目前無符合的貨物
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayedItems.map((item) => {
            const currentDestValue =
              item.placement === 'IN_STOCK'
                ? 'IN_STOCK'
                : `MACHINE:${item.machine_id || machines[0]?.machine_id || ''}`;

            return (
              <div
                key={item.item_id}
                className="bg-[#111827] border border-[#1E293B] rounded-xl p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.category}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          item.acquisition_source === '打台'
                            ? 'bg-amber-500/15 text-amber-300'
                            : item.acquisition_source === '二手'
                            ? 'bg-purple-500/15 text-purple-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {item.acquisition_source}
                      </span>
                      <span className="text-slate-400">
                        ${item.unit_cost} × {item.quantity}件
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold text-white">
                      ${(item.unit_cost * item.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 底部：一鍵切換去向 + 刪除 */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <select
                      value={currentDestValue}
                      onChange={(e) =>
                        handleInstantDestinationChange(item, e.target.value)
                      }
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="IN_STOCK">📦 倉庫庫存</option>
                      {machines.map((m) => (
                        <option key={m.machine_id} value={`MACHINE:${m.machine_id}`}>
                          🎯 [{m.code}] {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.item_id)}
                    className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 active:bg-rose-500/10 active:scale-95 shrink-0 transition-all touch-manipulation"
                    title="刪除庫存商品"
                    aria-label="刪除庫存商品"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增貨物彈窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-400" />
                新增貨物 / 獎品
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">名稱</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="例如：海賊王魯夫公仔"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">類別</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCatInModal(!isAddingNewCatInModal)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold"
                    >
                      {isAddingNewCatInModal ? '選擇既有' : '+ 新增類別'}
                    </button>
                  </div>
                  {isAddingNewCatInModal ? (
                    <input
                      type="text"
                      required
                      value={newCatInModalName}
                      onChange={(e) => setNewCatInModalName(e.target.value)}
                      placeholder="輸入新類別"
                      className="w-full bg-[#0B0F17] border border-amber-500/60 rounded-lg px-2.5 py-2 text-xs text-amber-300 placeholder-slate-600 focus:outline-none"
                    />
                  ) : (
                    <select
                      value={itemCategory}
                      onChange={(e) => {
                        if (e.target.value === '__NEW_CATEGORY__') {
                          setIsAddingNewCatInModal(true);
                        } else {
                          setItemCategory(e.target.value);
                        }
                      }}
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__NEW_CATEGORY__">+ 新增自訂類別...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">獲取方式</label>
                  <select
                    value={itemSource}
                    onChange={(e) =>
                      setItemSource(e.target.value as AcquisitionSource)
                    }
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-amber-400 font-bold"
                  >
                    {ACQUISITION_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">單價成本 ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={itemCost === 0 ? '' : itemCost}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setItemCost(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">數量</label>
                  <input
                    type="number"
                    min={1}
                    value={itemQty === 0 ? '' : itemQty}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; e.target.select(); }}
                    onChange={(e) => setItemQty(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="1"
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">存放位置</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemTargetPlacement('IN_STOCK')}
                    className={`py-2 rounded-lg text-xs font-bold border ${
                      itemTargetPlacement === 'IN_STOCK'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#0B0F17] text-slate-400 border-slate-800'
                    }`}
                  >
                    倉庫庫存
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemTargetPlacement('ON_MACHINE')}
                    className={`py-2 rounded-lg text-xs font-bold border ${
                      itemTargetPlacement === 'ON_MACHINE'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#0B0F17] text-slate-400 border-slate-800'
                    }`}
                  >
                    機台庫存
                  </button>
                </div>
              </div>

              {itemTargetPlacement === 'ON_MACHINE' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">選擇機台</label>
                  <select
                    value={itemTargetMachineId}
                    onChange={(e) => setItemTargetMachineId(e.target.value)}
                    className="w-full bg-[#0B0F17] border border-amber-500/50 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    {machines.map((m) => (
                      <option key={m.machine_id} value={m.machine_id}>
                        [{m.code}] {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs"
              >
                確認新增
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
