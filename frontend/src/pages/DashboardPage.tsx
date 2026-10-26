import { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Package, ShoppingBag, DollarSign,
  Users, AlertTriangle, RefreshCw, Calendar
} from 'lucide-react';
import { reportApi, DailyReport, StockReport } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [daily, stock] = await Promise.all([
        reportApi.daily(selectedDate, user?.branch?.id),
        reportApi.stock(),
      ]);
      setReport(daily);
      setStockReport(stock);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedDate]);

  const lowStockItems = stockReport.filter((s) => s.isLowStock);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm">Sales overview and store metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card h-28"><div className="shimmer h-full rounded-lg" /></div>
          ))}
        </div>
      ) : report ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<ShoppingBag className="w-6 h-6 text-store-green" />}
              label="Total Sales"
              value={formatCurrency(report.totalSales)}
              sub={`${report.totalTransactions} transactions`}
              color="green"
            />
            <StatCard
              icon={<DollarSign className="w-6 h-6 text-blue-500" />}
              label="Net Revenue"
              value={formatCurrency(report.netSales)}
              sub={`After ${formatCurrency(report.totalRefunds)} refunds`}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6 text-amber-500" />}
              label="Cash Collected"
              value={formatCurrency(report.totalCash)}
              sub={`Card: ${formatCurrency(report.totalCard)}`}
              color="amber"
            />
            <StatCard
              icon={<BarChart2 className="w-6 h-6 text-purple-500" />}
              label="Discounts Given"
              value={formatCurrency(report.totalDiscount)}
              sub={`${report.totalTransactions > 0 ? Math.round((report.totalDiscount / report.totalSales) * 100) : 0}% of sales`}
              color="purple"
            />
          </div>

          {/* Top Products + Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-heading font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-store-green" />
                Top Products Today
              </h3>
              {report.topProducts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No sales recorded today</p>
              ) : (
                <div className="space-y-3">
                  {report.topProducts.map((product, i) => (
                    <div key={product.productId} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-store-green/10 text-store-green rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400">Qty: {product.qty}</p>
                      </div>
                      <span className="font-bold text-sm text-gray-800">{formatCurrency(product.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-heading font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Low Stock Alerts
                {lowStockItems.length > 0 && (
                  <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {lowStockItems.length}
                  </span>
                )}
              </h3>
              {lowStockItems.length === 0 ? (
                <p className="text-gray-400 text-center py-8">All stock levels are healthy ✓</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStockItems.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category} · {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-600">{item.onHandQty} {item.unit}</p>
                        <p className="text-xs text-gray-400">Min: {item.reorderLevel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No data available for selected date</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50',
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
    purple: 'bg-purple-50',
  };

  return (
    <div className="stat-card animate-fade-in">
      <div className={`w-11 h-11 rounded-xl ${colors[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-xl font-heading font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
