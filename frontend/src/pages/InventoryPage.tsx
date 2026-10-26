import { useState, useEffect } from 'react';
import { inventoryApi, supplierApi, productApi, InventoryBalance, Supplier, Product } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Plus, TruckIcon, Package, ArrowUpDown, AlertTriangle, X } from 'lucide-react';

type Tab = 'balances' | 'receive' | 'adjust' | 'movements';

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('balances');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Receive goods form
  const [receiveForm, setReceiveForm] = useState({
    supplierId: '',
    items: [{ productId: '', qty: '', unitCost: '', batchNumber: '', expiryDate: '' }],
  });

  // Adjust stock modal
  const [adjustModal, setAdjustModal] = useState<{ balance: InventoryBalance | null; show: boolean }>({ balance: null, show: false });
  const [adjustForm, setAdjustForm] = useState({ adjustmentType: 'INCREMENT' as 'INCREMENT' | 'DECREMENT' | 'SET', qty: '', reason: '' });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bals, sups, prods] = await Promise.all([
        inventoryApi.getBalances(lowStockOnly ? { lowStock: 'true' } : {}),
        supplierApi.getAll(),
        productApi.getAll(),
      ]);
      setBalances(bals);
      setSuppliers(sups);
      setProducts(prods);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [lowStockOnly]);

  const handleReceiveGoods = async () => {
    setSaving(true);
    try {
      await inventoryApi.receiveGoods({
        branchId: '', // will be set by backend from auth
        supplierId: receiveForm.supplierId,
        items: receiveForm.items.map((i) => ({
          productId: i.productId,
          qty: parseFloat(i.qty),
          unitCost: parseFloat(i.unitCost),
          batchNumber: i.batchNumber || undefined,
          expiryDate: i.expiryDate || undefined,
        })).filter((i) => i.productId && i.qty > 0),
      });
      setSuccess('Goods received successfully!');
      setReceiveForm({ supplierId: '', items: [{ productId: '', qty: '', unitCost: '', batchNumber: '', expiryDate: '' }] });
      setTimeout(() => { setSuccess(''); setTab('balances'); loadData(); }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustModal.balance) return;
    setSaving(true);
    try {
      await inventoryApi.adjust({
        branchId: adjustModal.balance.branch_id,
        productId: adjustModal.balance.product_id,
        adjustmentType: adjustForm.adjustmentType,
        qty: parseFloat(adjustForm.qty),
        reason: adjustForm.reason,
      });
      setAdjustModal({ balance: null, show: false });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addReceiveItem = () => {
    setReceiveForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', qty: '', unitCost: '', batchNumber: '', expiryDate: '' }],
    }));
  };

  const removeReceiveItem = (idx: number) => {
    setReceiveForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateReceiveItem = (idx: number, field: string, value: string) => {
    setReceiveForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const tabs = [
    { id: 'balances', label: 'Stock Balances', icon: <Package className="w-4 h-4" /> },
    { id: 'receive', label: 'Receive Goods', icon: <TruckIcon className="w-4 h-4" /> },
    { id: 'adjust', label: 'Adjustments', icon: <ArrowUpDown className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="p-6 space-y-5">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-xl border-b-2 transition-all ${tab === t.id ? 'text-store-green border-store-green bg-store-green-bg' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl font-medium flex items-center gap-2">
          ✅ {success}
        </div>
      )}

      {/* Stock Balances */}
      {tab === 'balances' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="accent-store-green w-4 h-4" />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Show low stock only
              </span>
            </label>
            <span className="text-sm text-gray-400">{balances.length} items</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">On Hand</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Available</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reorder At</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Value</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-4"><div className="shimmer h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : balances.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No inventory records found</td></tr>
                ) : (
                  balances.map((bal) => {
                    const isLow = bal.on_hand_qty <= bal.reorder_level;
                    const price = bal.product?.prices?.[0];
                    const stockValue = bal.on_hand_qty * (price?.purchase_cost || 0);
                    return (
                      <tr key={bal.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors group ${isLow ? 'bg-orange-50/30' : ''}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-sm text-gray-800">{bal.product?.name_en}</p>
                          <p className="text-xs text-gray-400">{bal.product?.category?.name} · {bal.product?.unit?.code}</p>
                        </td>
                        <td className={`px-4 py-3.5 text-center font-bold ${isLow ? 'text-orange-600' : 'text-gray-800'}`}>
                          {bal.on_hand_qty}
                        </td>
                        <td className="px-4 py-3.5 text-center text-gray-600">{bal.available_qty}</td>
                        <td className="px-4 py-3.5 text-center text-gray-500">{bal.reorder_level}</td>
                        <td className="px-4 py-3.5 text-center text-sm font-semibold text-gray-700">
                          {formatCurrency(stockValue)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {isLow
                            ? <span className="badge-low">Low Stock</span>
                            : <span className="badge-completed">OK</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => { setAdjustModal({ balance: bal, show: true }); setAdjustForm({ adjustmentType: 'INCREMENT', qty: '', reason: '' }); }}
                            className="px-3 py-1.5 text-xs font-semibold text-store-green bg-store-green-bg rounded-lg hover:bg-store-green hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive Goods */}
      {tab === 'receive' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 max-w-3xl">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Supplier *</label>
            <select value={receiveForm.supplierId} onChange={(e) => setReceiveForm({ ...receiveForm, supplierId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green">
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Items Received</label>
              <button onClick={addReceiveItem} className="flex items-center gap-1.5 text-sm text-store-green font-medium hover:underline">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {receiveForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-xl">
                  <div className="col-span-4">
                    <label className="text-xs text-gray-500 mb-1 block">Product</label>
                    <select value={item.productId} onChange={(e) => updateReceiveItem(idx, 'productId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-store-green">
                      <option value="">Select...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name_en}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                    <input type="number" value={item.qty} onChange={(e) => updateReceiveItem(idx, 'qty', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-store-green" placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Unit Cost</label>
                    <input type="number" value={item.unitCost} onChange={(e) => updateReceiveItem(idx, 'unitCost', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-store-green" placeholder="Rs." />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Expiry</label>
                    <input type="date" value={item.expiryDate} onChange={(e) => updateReceiveItem(idx, 'expiryDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-store-green" />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {receiveForm.items.length > 1 && (
                      <button onClick={() => removeReceiveItem(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="p-3 bg-store-green-bg rounded-xl mb-4 text-sm text-gray-700">
              <strong>Total Cost:</strong> {formatCurrency(receiveForm.items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitCost) || 0), 0))}
            </div>
            <button onClick={handleReceiveGoods} disabled={saving || !receiveForm.supplierId}
              className="w-full py-3 bg-store-green text-white rounded-xl font-semibold hover:bg-store-green-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <TruckIcon className="w-5 h-5" />
              {saving ? 'Processing...' : 'Record Goods Receipt (GRN)'}
            </button>
          </div>
        </div>
      )}

      {/* Adjust tab - show balance table with adjust button */}
      {tab === 'adjust' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-500">
          <ArrowUpDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">To adjust stock, go to <strong>Stock Balances</strong> tab and click <strong>Adjust</strong> on any product.</p>
          <button onClick={() => setTab('balances')} className="mt-3 text-store-green font-semibold hover:underline text-sm">
            Go to Stock Balances →
          </button>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustModal.show && adjustModal.balance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-gray-800">Adjust Stock</h3>
              <button onClick={() => setAdjustModal({ balance: null, show: false })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="font-semibold text-gray-800">{adjustModal.balance.product?.name_en}</p>
              <p className="text-sm text-gray-500">Current stock: <strong>{adjustModal.balance.on_hand_qty}</strong> {adjustModal.balance.product?.unit?.code}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Adjustment Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['INCREMENT', 'DECREMENT', 'SET'] as const).map((t) => (
                  <button key={t} onClick={() => setAdjustForm({ ...adjustForm, adjustmentType: t })}
                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${adjustForm.adjustmentType === t ? 'border-store-green bg-store-green-bg text-store-green' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'INCREMENT' ? '+ Add' : t === 'DECREMENT' ? '- Remove' : 'Set'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Quantity</label>
              <input type="number" value={adjustForm.qty} onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="Enter quantity" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Reason *</label>
              <input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="e.g., Damage, Expiry, Physical count" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAdjustModal({ balance: null, show: false })} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={saving || !adjustForm.qty || !adjustForm.reason}
                className="flex-1 py-2.5 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark disabled:opacity-50">
                {saving ? 'Saving...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
