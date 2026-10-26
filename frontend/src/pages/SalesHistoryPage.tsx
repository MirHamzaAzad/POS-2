import { useState, useEffect } from 'react';
import { saleApi, Sale } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Search, Eye, X, Receipt, RotateCcw } from 'lucide-react';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const data = await saleApi.getAll({ startDate, endDate });
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSales(); }, [startDate, endDate]);

  const filtered = sales.filter((s) =>
    !search || s.invoice_number.toLowerCase().includes(search.toLowerCase())
  );

  const handleVoid = async () => {
    if (!voidTarget || !voidReason) return;
    setProcessing(true);
    try {
      await saleApi.void(voidTarget.id, voidReason);
      setShowVoidModal(false);
      setVoidReason('');
      loadSales();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'badge-completed',
      VOIDED: 'badge-voided',
      PARTIALLY_REFUNDED: 'badge-pending',
    };
    return <span className={map[status] || 'badge-pending'}>{status}</span>;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice..." className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green w-48" />
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" />
        <span className="ml-auto text-sm text-gray-400">{filtered.length} sales</span>
        <span className="font-bold text-store-green text-sm">
          Total: {formatCurrency(filtered.filter(s => s.sale_status === 'COMPLETED').reduce((s, sale) => s + sale.grand_total, 0))}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cashier</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Payment</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="shimmer h-4 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No sales found</p>
              </td></tr>
            ) : (
              filtered.map((sale) => (
                <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-3.5 font-mono text-sm font-semibold text-store-green">{sale.invoice_number}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{formatDateTime(sale.created_at)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{(sale as any).cashier?.full_name || '—'}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-800">{formatCurrency(sale.grand_total)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-medium text-gray-600">{sale.payments?.[0]?.payment_method || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">{statusBadge(sale.sale_status)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setViewSale(sale)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      {sale.sale_status === 'COMPLETED' && (
                        <button onClick={() => { setVoidTarget(sale); setShowVoidModal(true); }}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Void">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Sale Modal */}
      {viewSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-heading font-bold text-gray-800">{viewSale.invoice_number}</h3>
                <p className="text-xs text-gray-400">{formatDateTime(viewSale.created_at)}</p>
              </div>
              <button onClick={() => setViewSale(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                {viewSale.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.product_name_snapshot} <span className="text-gray-400">×{item.qty}</span></span>
                    <span className="font-semibold text-gray-800">{formatCurrency(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(viewSale.subtotal)}</span></div>
                {viewSale.discount_total > 0 && <div className="flex justify-between text-sm text-store-green"><span>Discount</span><span>-{formatCurrency(viewSale.discount_total)}</span></div>}
                <div className="flex justify-between font-bold text-gray-800"><span>Total</span><span>{formatCurrency(viewSale.grand_total)}</span></div>
                <div className="flex justify-between text-sm text-gray-600"><span>Paid ({viewSale.payments?.[0]?.payment_method})</span><span>{formatCurrency(viewSale.amount_paid)}</span></div>
                {viewSale.change_returned > 0 && <div className="flex justify-between text-sm text-amber-700"><span>Change</span><span>{formatCurrency(viewSale.change_returned)}</span></div>}
              </div>
              <div className="pt-2">{statusBadge(viewSale.sale_status)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && voidTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in p-6 space-y-4">
            <h3 className="font-heading font-bold text-gray-800">Void Sale</h3>
            <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">
              ⚠️ You are about to void <strong>{voidTarget.invoice_number}</strong> ({formatCurrency(voidTarget.grand_total)}). Stock will be restored.
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Reason *</label>
              <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400" placeholder="Enter reason for voiding" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowVoidModal(false); setVoidReason(''); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={handleVoid} disabled={processing || !voidReason}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 disabled:opacity-50">
                {processing ? 'Voiding...' : 'Void Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
