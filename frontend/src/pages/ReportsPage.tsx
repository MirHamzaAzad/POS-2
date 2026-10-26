import { useState, useEffect } from 'react';
import { reportApi, DailyReport, StockReport } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { BarChart2, Download, Calendar, Package } from 'lucide-react';

type ReportTab = 'daily' | 'stock';

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      if (tab === 'daily') {
        const data = await reportApi.daily(date);
        setDailyReport(data);
      } else {
        const data = await reportApi.stock();
        setStockReport(data);
      }
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadReport(); }, [tab, date]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {(['daily', 'stock'] as ReportTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${tab === t ? 'bg-store-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'daily' ? '📅 Daily Report' : '📦 Stock Report'}
            </button>
          ))}
        </div>
        {tab === 'daily' && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="ml-auto px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="w-8 h-8 border-2 border-store-green/30 border-t-store-green rounded-full animate-spin mr-3" />
          Loading report...
        </div>
      ) : tab === 'daily' && dailyReport ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: formatCurrency(dailyReport.totalSales), sub: `${dailyReport.totalTransactions} transactions`, color: 'bg-green-50 text-store-green' },
              { label: 'Net Revenue', value: formatCurrency(dailyReport.netSales), sub: `After refunds`, color: 'bg-blue-50 text-blue-600' },
              { label: 'Cash', value: formatCurrency(dailyReport.totalCash), sub: `Card: ${formatCurrency(dailyReport.totalCard)}`, color: 'bg-amber-50 text-amber-600' },
              { label: 'Discounts', value: formatCurrency(dailyReport.totalDiscount), sub: `Refunds: ${formatCurrency(dailyReport.totalRefunds)}`, color: 'bg-purple-50 text-purple-600' },
            ].map((card) => (
              <div key={card.label} className="stat-card">
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-heading font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-heading font-bold text-gray-800 mb-4">Top Products — {formatDate(dailyReport.date)}</h3>
            {dailyReport.topProducts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No sales data available</p>
            ) : (
              <div className="space-y-3">
                {dailyReport.topProducts.map((p, i) => {
                  const maxRevenue = dailyReport.topProducts[0]?.revenue || 1;
                  return (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className="w-6 text-xs font-bold text-gray-400">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{p.name}</span>
                          <span className="text-sm font-bold text-gray-800">{formatCurrency(p.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-store-green rounded-full transition-all" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Qty sold: {p.qty}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'stock' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="font-heading font-bold text-gray-800">Stock Valuation Report</h3>
              <p className="text-xs text-gray-400 mt-0.5">Total value: {formatCurrency(stockReport.reduce((s, r) => s + r.stockValue, 0))}</p>
            </div>
            <span className="text-sm text-orange-600 font-semibold bg-orange-50 px-3 py-1 rounded-full">
              ⚠️ {stockReport.filter(r => r.isLowStock).length} low stock
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">On Hand</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Retail Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Value</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockReport.map((r) => (
                  <tr key={r.productId} className={`border-b border-gray-50 hover:bg-gray-50/50 ${r.isLowStock ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.category}</td>
                    <td className="px-4 py-3 text-center font-bold text-sm">{r.onHandQty} {r.unit}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(r.retailPrice)}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm text-gray-800">{formatCurrency(r.stockValue)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.isLowStock ? <span className="badge-low">Low</span> : <span className="badge-completed">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
