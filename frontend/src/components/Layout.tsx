import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart2,
  Users, ShoppingBag, LogOut, Menu, X, Truck, ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import POSPage from '../pages/POSPage';
import DashboardPage from '../pages/DashboardPage';
import ProductsPage from '../pages/ProductsPage';
import InventoryPage from '../pages/InventoryPage';
import SalesHistoryPage from '../pages/SalesHistoryPage';
import ReportsPage from '../pages/ReportsPage';
import UsersPage from '../pages/UsersPage';
import { useOfflineSync, useOnlineStatus } from '../hooks/usePos';

type Page = 'pos' | 'dashboard' | 'products' | 'inventory' | 'sales' | 'reports' | 'users';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { id: 'pos', label: 'POS Counter', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'products', label: 'Products', icon: <Package className="w-5 h-5" />, roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
  { id: 'inventory', label: 'Inventory', icon: <Truck className="w-5 h-5" />, roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
  { id: 'sales', label: 'Sales History', icon: <ClipboardList className="w-5 h-5" />, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { id: 'reports', label: 'Reports', icon: <BarChart2 className="w-5 h-5" />, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" />, roles: ['ADMIN'] },
];

export default function MainLayout() {
  const { user, logout, hasRole } = useAuth();
  const { pendingCount } = useOfflineSync();
  const isOnline = useOnlineStatus();
  const [activePage, setActivePage] = useState<Page>('pos');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const accessibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => user?.roles.includes(r))
  );

  const renderPage = () => {
    switch (activePage) {
      case 'pos': return <POSPage />;
      case 'dashboard': return <DashboardPage />;
      case 'products': return <ProductsPage />;
      case 'inventory': return <InventoryPage />;
      case 'sales': return <SalesHistoryPage />;
      case 'reports': return <ReportsPage />;
      case 'users': return <UsersPage />;
      default: return <POSPage />;
    }
  };

  // POS page gets full screen without sidebar
  if ((activePage as string) === 'pos') {
    return (
      <div className="h-screen flex flex-col">
        {/* Mini nav bar for POS */}
        <div className="flex items-center gap-2 px-4 py-2 bg-store-green-dark border-b border-store-green/40 flex-shrink-0">
          <ShoppingBag className="w-5 h-5 text-white" />
          <span className="text-white font-heading font-bold text-sm">Galiyat Store</span>
          <div className="flex gap-1 ml-4 overflow-x-auto flex-1">
            {accessibleNavItems.filter(i => i.id !== 'pos').map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-green-200 hover:text-white hover:bg-white/10 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-300' : 'bg-amber-400'}`} />
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{pendingCount}</span>
            )}
            <span className="text-green-200 text-xs">{user?.fullName}</span>
            <button onClick={logout} className="text-green-200 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <POSPage />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-store-green rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-heading font-bold text-gray-800 text-sm leading-none">گلیات اسٹور</p>
              <p className="text-gray-400 text-xs">POS System</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {accessibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full sidebar-item ${activePage === item.id ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-2' : ''}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {item.id === 'pos' && pendingCount > 0 && sidebarOpen && (
                <span className="ml-auto bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-gray-100">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-gray-50 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-store-green rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{user?.fullName?.[0]}</span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-gray-700 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.roles?.[0]}</p>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Online status */}
          {sidebarOpen && (
            <div className="flex items-center gap-2 mt-2 px-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-gray-400">{isOnline ? 'Online' : 'Offline mode'}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Page header bar */}
        <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center gap-3 flex-shrink-0">
          {activePage !== 'pos' && (
            <>
              {navItems.find(n => n.id === activePage)?.icon && (
                <span className="text-store-green">
                  {navItems.find(n => n.id === activePage)?.icon}
                </span>
              )}
              <h1 className="font-heading font-bold text-gray-800">
                {navItems.find(n => n.id === activePage)?.label}
              </h1>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.branch?.name || 'Main Branch'}</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
