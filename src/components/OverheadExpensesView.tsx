import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Building2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  History,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Expense, Machine, MachineCustomFee, MachinePaymentRecord } from '../types';
import { calculateSimpleOverhead } from '../utils/calculations';

interface OverheadExpensesViewProps {
  machines: Machine[];
  expenses: Expense[];
  onUpdateMachineFixedCosts: (
    machineId: string,
    updates: Pick<
      Machine,
      'rent_monthly' | 'other_fixed_fee' | 'other_fee_note'
    >
  ) => void;
  onUpdateMachineCustomFees: (machineId: string, fees: MachineCustomFee[]) => void;
  onRecordMachinePayment: (
    machineId: string,
    payment: Omit<MachinePaymentRecord, 'payment_id' | 'paid_at'>
  ) => void;
  onUpdateMachineRentPayDay: (machineId: string, payDay: number) => void;
  onAddExpense: (payload: Omit<Expense, 'expense_id'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  onDeleteMachine: (machineId: string) => void;
}

const PRESET_CONSUMABLE_TITLES = [
  '爪套',
  '彈力繩',
  '防甩片',
  '消光膠帶',
  '擋板',
];

export const OverheadExpensesView: React.FC<OverheadExpensesViewProps> = ({
  machines,
  expenses,
  onUpdateMachineFixedCosts,
  onUpdateMachineCustomFees,
  onRecordMachinePayment,
  onUpdateMachineRentPayDay,
  onAddExpense,
  onDeleteExpense,
  onDeleteMachine,
}) => {
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [editDraft, setEditDraft] = useState<{
    rent_monthly: number;
    other_fixed_fee: number;
    other_fee_note: string;
    rent_pay_day: number;
  }>({
    rent_monthly: 0,
    other_fixed_fee: 0,
    other_fee_note: '',
    rent_pay_day: 5,
  });

  // 新增自訂固定費用項目彈窗狀態
  const [feeModalMachine, setFeeModalMachine] = useState<Machine | null>(null);
  const [newFeeTitle, setNewFeeTitle] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState<number>(300);

  // 登記定期付款彈窗狀態
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [payModalMachine, setPayModalMachine] = useState<Machine | null>(null);
  const [payTitle, setPayTitle] = useState('');
  const [payAmount, setPayAmount] = useState<number>(4500);
  const [payNote, setPayNote] = useState('');

  // 檢視歷史付款紀錄彈窗
  const [historyModalMachine, setHistoryModalMachine] = useState<Machine | null>(null);

  const [showConsumablesSection, setShowConsumablesSection] = useState<boolean>(false);
  const [expTitle, setExpTitle] = useState<string>('');
  const [expMachineId, setExpMachineId] = useState<string>('ALL');
  const [expAmount, setExpAmount] = useState<number>(300);

  const overheadSummary = useMemo(
    () => calculateSimpleOverhead(machines, expenses, 'ALL'),
    [machines, expenses]
  );

  const maxMachineCost = useMemo(() => {
    const vals = machines.map((m) => {
      const customSum = (m.custom_fixed_fees || []).reduce(
        (s, f) => s + (Number(f.amount) || 0),
        0
      );
      return (Number(m.rent_monthly) || 0) + (Number(m.other_fixed_fee) || 0) + customSum;
    });
    return Math.max(1, ...vals);
  }, [machines]);

  const startEditingMachine = (m: Machine) => {
    setEditingMachineId(m.machine_id);
    setEditDraft({
      rent_monthly: m.rent_monthly,
      other_fixed_fee: m.other_fixed_fee || 0,
      other_fee_note: m.other_fee_note || '',
      rent_pay_day: m.rent_pay_day || 5,
    });
  };

  const saveMachineEdit = (machineId: string) => {
    onUpdateMachineFixedCosts(machineId, {
      rent_monthly: Math.max(0, Number(editDraft.rent_monthly) || 0),
      other_fixed_fee: Math.max(0, Number(editDraft.other_fixed_fee) || 0),
      other_fee_note: editDraft.other_fee_note.trim(),
    });
    onUpdateMachineRentPayDay(machineId, editDraft.rent_pay_day || 5);
    setEditingMachineId(null);
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) return;

    onAddExpense({
      machine_id: expMachineId === 'ALL' ? null : expMachineId,
      title: expTitle.trim(),
      amount: Number(expAmount),
      is_advanced_amortized: false,
      spread_days: 1,
      incurred_date: new Date().toISOString().slice(0, 10),
      note: '',
    });

    setExpTitle('');
  };

  const grandTotal = Math.max(1, overheadSummary.grandTotalOverhead);
  const rentPct = Math.round((overheadSummary.totalRent / grandTotal) * 100);
  const otherPct = Math.round(
    ((overheadSummary.totalOtherFixed + overheadSummary.totalConsumableExpenses) /
      grandTotal) *
      100
  );

  return (
    <div className="space-y-4">
      {/* 1. 總固定成本卡片 + 比例量表 */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">當月固定總開銷</div>
            <div className="text-2xl font-mono font-black text-amber-400">
              ${overheadSummary.grandTotalOverhead.toLocaleString()}
            </div>
          </div>
          <div className="text-right text-xs font-mono space-y-0.5">
            <div className="text-white">
              台租：${overheadSummary.totalRent.toLocaleString()} ({rentPct}%)
            </div>
            <div className="text-slate-400">
              其他/耗材：$
              {(
                overheadSummary.totalOtherFixed +
                overheadSummary.totalConsumableExpenses
              ).toLocaleString()}{' '}
              ({otherPct}%)
            </div>
          </div>
        </div>

        {/* 視覺化成本結構量表 */}
        <div className="w-full h-2.5 bg-[#0B0F17] rounded-full overflow-hidden flex border border-slate-800">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${rentPct}%` }}
          />
          <div className="h-full flex-1 bg-sky-500" />
        </div>
      </div>

      {/* 2. 各機台台租與其他費用卡片 (取代窄表格，不擠壓文字) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Building2 className="w-4 h-4 text-amber-400" />
            各機台台租設定
          </div>
          <span className="text-[11px] text-slate-400">點編輯可改台租與其他費用</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {machines.map((m) => {
            const isEditing = editingMachineId === m.machine_id;
            const customFeesList = m.custom_fixed_fees || [];
            const customFeesSum = customFeesList.reduce(
              (s, f) => s + (Number(f.amount) || 0),
              0
            );
            const totalMonthly = isEditing
              ? (Number(editDraft.rent_monthly) || 0) +
                (Number(editDraft.other_fixed_fee) || 0) +
                customFeesSum
              : (Number(m.rent_monthly) || 0) +
                (Number(m.other_fixed_fee) || 0) +
                customFeesSum;
            const barWidth = Math.min(
              100,
              Math.round((totalMonthly / maxMachineCost) * 100)
            );

            // 當月繳費狀態檢查
            const currentMonthPayment = (m.payment_records || []).find(
              (p) => p.period_label === currentMonthStr
            );
            const payDay = m.rent_pay_day || 5;

            return (
              <div
                key={m.machine_id}
                className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3"
              >
                {/* 頂部名稱與操作 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                        {m.code}
                      </span>
                      <span className="text-sm font-bold text-white truncate">
                        {m.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.location}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditingMachine(m)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => setMachineToDelete(m)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="刪除此機台與相關數據"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => saveMachineEdit(m.machine_id)}
                        className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMachineId(null)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 定期繳款狀態標籤列 (需求 6) */}
                <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-slate-400 text-[11px]">
                      每月 {payDay} 號繳租：
                    </span>
                    {currentMonthPayment ? (
                      <span className="font-bold text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        本月已付
                      </span>
                    ) : (
                      <span className="font-bold text-amber-400 text-[11px]">
                        本月待繳 ${totalMonthly.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!currentMonthPayment && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayModalMachine(m);
                          setPayTitle(`${currentMonthStr} 台租與固定費用`);
                          setPayAmount(totalMonthly);
                          setPayNote('');
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] whitespace-nowrap hover:bg-amber-400 transition-colors"
                      >
                        登記已付
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHistoryModalMachine(m)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="查看繳費歷史紀錄"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2 pt-1 bg-[#0B0F17] p-3 rounded-xl border border-amber-500/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          基礎台租費用 ($)
                        </label>
                        <input
                          type="number"
                          value={editDraft.rent_monthly}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              rent_monthly: Number(e.target.value),
                            })
                          }
                          className="w-full bg-[#111827] border border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          每月繳租日 (1~31)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editDraft.rent_pay_day}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              rent_pay_day: Math.min(31, Math.max(1, Number(e.target.value) || 5)),
                            })
                          }
                          className="w-full bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {/* 固定基礎台租 */}
                    <div className="flex items-center justify-between text-xs bg-[#0B0F17] px-3 py-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[11px]">基礎月租金</span>
                      <span className="font-mono font-bold text-white">
                        ${m.rent_monthly.toLocaleString()}
                      </span>
                    </div>

                    {/* 自訂其他固定項目清單 (可一直添加多筆 - 需求 5) */}
                    {customFeesList.length > 0 && (
                      <div className="space-y-1">
                        {customFeesList.map((fee) => (
                          <div
                            key={fee.fee_id}
                            className="flex items-center justify-between text-xs bg-[#0B0F17]/60 px-3 py-1.5 rounded-lg border border-slate-800/80"
                          >
                            <span className="text-slate-300 text-[11px] truncate">
                              {fee.title}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-slate-300">
                                +${fee.amount.toLocaleString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = customFeesList.filter(
                                    (f) => f.fee_id !== fee.fee_id
                                  );
                                  onUpdateMachineCustomFees(m.machine_id, updated);
                                }}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 操作按鈕與月合計 */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFeeModalMachine(m);
                          setNewFeeTitle('');
                          setNewFeeAmount(300);
                        }}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新增其他費用項目
                      </button>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 mr-1.5">月固定合計</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          ${totalMonthly.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 選用耗材紀錄 (可收合) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowConsumablesSection(!showConsumablesSection)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-200">
              耗材支出設定 (選用 · {expenses.length} 筆)
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
            {showConsumablesSection ? (
              <>
                收合 <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                展開 <ChevronDown className="w-4 h-4" />
              </>
            )}
          </div>
        </button>

        {showConsumablesSection && (
          <div className="p-4 border-t border-slate-800 space-y-4">
            <form
              onSubmit={handleAddExpenseSubmit}
              className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2.5"
            >
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CONSUMABLE_TITLES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpTitle(preset)}
                    className="px-2.5 py-1 rounded-lg bg-[#111827] text-[11px] font-bold text-slate-300 border border-slate-800"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="耗材名稱"
                  className="bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <select
                  value={expMachineId}
                  onChange={(e) => setExpMachineId(e.target.value)}
                  className="bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="ALL">全場分攤</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      [{m.code}]
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  placeholder="金額"
                  className="bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs"
              >
                + 新增耗材
              </button>
            </form>

            <div className="space-y-2">
              {expenses.map((exp) => {
                const m = machines.find((mc) => mc.machine_id === exp.machine_id);
                return (
                  <div
                    key={exp.expense_id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-mono text-amber-400 shrink-0">
                        {m ? `[${m.code}]` : '[全場]'}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {exp.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-white">
                        ${exp.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.expense_id)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
                <li>該機台的所有收幣／抄錶歷史紀錄</li>
                <li>該機台綁定的刮刮樂活動看板及獎品進度</li>
                <li>該機台專屬的所有月固定租金與雜費開銷項目</li>
                <li>擺設在該機台內的商品庫存將自動歸位回「倉庫備品」</li>
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

      {/* 新增其他固定費用項目彈窗 (需求 5) */}
      {feeModalMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>新增固定費用項目 [{feeModalMachine.code}]</span>
              </div>
              <button
                type="button"
                onClick={() => setFeeModalMachine(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              可無限制添加固定分攤項目（如公家電費、網路監視器、冷氣費、折舊等），將自動計入每月固定支出。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">費用項目名稱</label>
                <input
                  type="text"
                  required
                  value={newFeeTitle}
                  onChange={(e) => setNewFeeTitle(e.target.value)}
                  placeholder="例如：公家電費分攤"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">每月金額 ($)</label>
                <input
                  type="number"
                  min={0}
                  value={newFeeAmount}
                  onChange={(e) => setNewFeeAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFeeModalMachine(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newFeeTitle.trim()) return;
                  const newFeeItem: MachineCustomFee = {
                    fee_id: `cf_${Date.now()}`,
                    title: newFeeTitle.trim(),
                    amount: newFeeAmount,
                  };
                  const currentList = feeModalMachine.custom_fixed_fees || [];
                  onUpdateMachineCustomFees(feeModalMachine.machine_id, [
                    ...currentList,
                    newFeeItem,
                  ]);
                  setFeeModalMachine(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-950/40"
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 登記定期已付款彈窗 (需求 6) */}
      {payModalMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-emerald-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>登記付款 [{payModalMachine.code}]</span>
              </div>
              <button
                type="button"
                onClick={() => setPayModalMachine(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">付款項目說明</label>
                <input
                  type="text"
                  value={payTitle}
                  onChange={(e) => setPayTitle(e.target.value)}
                  placeholder="例如：2026-11 台租繳納"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">實付金額 ($)</label>
                <input
                  type="number"
                  min={0}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">備註 (選填，如匯款末五碼)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="例如：台新轉帳後五碼 88888"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayModalMachine(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onRecordMachinePayment(payModalMachine.machine_id, {
                    machine_id: payModalMachine.machine_id,
                    title: payTitle.trim() || `${currentMonthStr} 台租與雜費`,
                    amount: payAmount,
                    period_label: currentMonthStr,
                    status: 'PAID',
                    note: payNote.trim(),
                  });
                  setPayModalMachine(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-950/40"
              >
                確認記錄已付款
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 檢視繳款歷史紀錄彈窗 (需求 6) */}
      {historyModalMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <History className="w-4 h-4 text-amber-400" />
                <span>繳費歷史紀錄 [{historyModalMachine.code}]</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalMachine(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {(historyModalMachine.payment_records || []).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  尚無繳款紀錄
                </div>
              ) : (
                historyModalMachine.payment_records?.map((record) => (
                  <div
                    key={record.payment_id}
                    className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{record.title}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${record.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>付款時間：{new Date(record.paid_at).toLocaleDateString()}</span>
                      <span className="text-emerald-500">已入帳</span>
                    </div>
                    {record.note && (
                      <div className="text-[10px] text-slate-400 bg-slate-900/50 p-1.5 rounded">
                        備註：{record.note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setHistoryModalMachine(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
