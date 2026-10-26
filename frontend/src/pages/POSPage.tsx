import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Scan, Search, X, Plus, Minus, Trash2,
  CreditCard, Banknote, CheckCircle, Printer, RotateCcw,
  Wifi, WifiOff, AlertCircle, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProductSearch, useOfflineSync, useOnlineStatus } from '../hooks/usePos';
import { Product, CartItem } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';

type PaymentMethod = 'CASH' | 'CARD' | 'MIXED';

interface CompletedSale {
  invoiceNumber: string;
  items: CartItem[];
  grandTotal: number;
  amountPaid: number;
  changeReturned: number;
  paymentMethod: PaymentMethod;
  isOffline?: boolean;
  createdAt: Date;
}

export default function POSPage() {
  const { user } = useAuth();
  const { results: searchResults, isLoading: searchLoading, search, getByBarcode } = useProductSearch();
  const { pendingCount, submitSale } = useOfflineSync();
  const isOnline = useOnlineStatus();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [billDiscount, setBillDiscount] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Totals
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice - i.discountAmount, 0);
  const taxTotal = cart.reduce((s, i) => s + i.taxAmount, 0);
  const grandTotal = Math.max(0, subtotal + taxTotal - billDiscount);
  const changeReturned = Math.max(0, (parseFloat(amountPaid) || 0) - grandTotal);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const addToCart = useCallback((product: Product, qty = 1) => {
    const price = product.prices?.[0];
    if (!price) { showNotification('error', 'Product has no price set'); return; }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, {
        product,
        qty,
        unitPrice: price.retail_price,
        discountAmount: 0,
        taxAmount: 0,
      }];
    });
    setSearchQuery('');
    setShowSearch(false);
    setBarcodeInput('');
    barcodeRef.current?.focus();
  }, []);

  const handleBarcodeInput = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const product = await getByBarcode(barcodeInput.trim());
      if (product) {
        addToCart(product);
      } else {
        showNotification('error', `Product not found: ${barcodeInput}`);
      }
    }
  }, [barcodeInput, getByBarcode, addToCart]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        search(searchQuery);
        setShowSearch(true);
      } else {
        setShowSearch(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, search]);

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, qty: newQty } : i));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setBillDiscount(0);
    setAmountPaid('');
    setShowPayment(false);
    barcodeRef.current?.focus();
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) { showNotification('error', 'Cart is empty'); return; }
    const paid = parseFloat(amountPaid) || 0;
    if (paymentMethod === 'CASH' && paid < grandTotal) {
      showNotification('error', 'Amount paid is less than total');
      return;
    }

    setIsProcessing(true);
    try {
      const branchId = user?.branch?.id || '';
      const payload = {
        branchId,
        items: cart.map((i) => ({
          productId: i.product.id,
          qty: i.qty,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          taxAmount: i.taxAmount,
        })),
        discountTotal: billDiscount,
        taxTotal,
        amountPaid: paid || grandTotal,
        paymentMethod,
        channel: 'POS' as const,
      };

      const result = await submitSale(payload);

      setCompletedSale({
        invoiceNumber: result.invoiceNumber || 'OFFLINE',
        items: [...cart],
        grandTotal,
        amountPaid: paid || grandTotal,
        changeReturned,
        paymentMethod,
        isOffline: result.offline,
        createdAt: new Date(),
      });

      clearCart();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to complete sale');
    } finally {
      setIsProcessing(false);
    }
  };

  const printReceipt = () => window.print();

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <header className="bg-store-green text-white px-6 py-3 flex items-center justify-between shadow-lg flex-shrink-0">
        <div className="flex items-center gap-4">
          <ShoppingCart className="w-6 h-6" />
          <div>
            <h1 className="font-heading font-bold text-lg leading-none">Galiyat Store POS</h1>
            <p className="text-green-200 text-xs">{user?.fullName} — {user?.branch?.name || 'Main Branch'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isOnline ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          {pendingCount > 0 && (
            <div className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {pendingCount} pending sync
            </div>
          )}
          <div className="text-right text-sm">
            <p className="font-semibold">{new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="text-green-200 text-xs">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className={`mx-4 mt-2 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-fade-in flex-shrink-0 ${notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left Panel — Cart */}
        <div className="flex flex-col w-[55%] border-r border-gray-200 bg-white">
          {/* Scan/Search bar */}
          <div className="p-4 border-b border-gray-100 space-y-3 flex-shrink-0">
            {/* Barcode scanner input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-store-green" />
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  placeholder="Scan barcode or press Enter..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-store-green/30 focus:border-store-green rounded-xl text-sm font-mono outline-none transition-all bg-store-green-bg"
                  autoFocus
                />
              </div>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product by name, SKU..."
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green transition-all"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {showSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                  {searchLoading ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No products found</div>
                  ) : (
                    searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="w-full text-left px-4 py-3 hover:bg-store-green-bg flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{product.name_en}</p>
                          <p className="text-xs text-gray-500">{product.sku} · {product.category?.name}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-store-green text-sm">
                            {product.prices?.[0] ? formatCurrency(product.prices[0].retail_price) : 'N/A'}
                          </p>
                          <StorageBadge type={product.storage_type} />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                <ShoppingCart className="w-16 h-16" strokeWidth={1} />
                <p className="font-body text-lg">Cart is empty</p>
                <p className="text-sm">Scan a barcode or search for products</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={item.product.id} className="cart-item animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{item.product.name_en}</p>
                    <p className="text-xs text-gray-500">{item.product.sku} · {formatCurrency(item.unitPrice)} each</p>
                    {item.discountAmount > 0 && (
                      <p className="text-xs text-store-green">Discount: -{formatCurrency(item.discountAmount)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateQty(item.product.id, item.qty - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-bold text-gray-800">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.product.id, item.qty + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-100 hover:text-store-green transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <p className="w-24 text-right font-bold text-gray-800 text-sm">
                      {formatCurrency(item.qty * item.unitPrice - item.discountAmount)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 p-4 space-y-2 flex-shrink-0 bg-gray-50/50">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Items ({cart.reduce((s, i) => s + i.qty, 0)})</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {billDiscount > 0 && (
                <div className="flex justify-between text-sm text-store-green font-medium">
                  <span>Bill Discount</span>
                  <span>-{formatCurrency(billDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-heading font-bold text-xl text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="text-store-green">{formatCurrency(grandTotal)}</span>
              </div>

              {/* Discount input */}
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={billDiscount || ''}
                  onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Bill discount (Rs.)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-store-green"
                />
                <button onClick={clearCart} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-sm">
                  <RotateCcw className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Payment */}
        <div className="flex flex-col w-[45%] bg-white">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-heading font-bold text-xl text-gray-800 mb-1">Payment</h2>
            <p className="text-gray-500 text-sm">{cart.length} items in cart</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Amount display */}
            <div className="bg-gradient-to-br from-store-green to-store-green-dark rounded-2xl p-6 text-white text-center">
              <p className="text-green-200 text-sm font-medium mb-1">Total Amount</p>
              <p className="text-4xl font-heading font-bold">{formatCurrency(grandTotal)}</p>
            </div>

            {/* Payment method selection */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'CARD', 'MIXED'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm flex flex-col items-center gap-1 transition-all border-2 ${paymentMethod === method ? 'border-store-green bg-store-green-bg text-store-green' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                  >
                    {method === 'CASH' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount paid input */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {paymentMethod === 'CASH' ? 'Amount Received' : 'Amount'}
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={formatCurrency(grandTotal).replace('Rs. ', '')}
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center outline-none focus:border-store-green transition-all"
              />
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {['7','8','9','4','5','6','1','2','3','C','0','.'].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'C') setAmountPaid('');
                    else setAmountPaid((prev) => prev + key);
                  }}
                  className={`numpad-btn ${key === 'C' ? 'text-red-500 hover:bg-red-50' : ''}`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[500, 1000, 2000, 5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setAmountPaid(String(amount))}
                  className="py-2 bg-gray-100 hover:bg-store-green hover:text-white text-gray-700 rounded-lg text-sm font-semibold transition-all"
                >
                  {amount}
                </button>
              ))}
            </div>

            {/* Change */}
            {changeReturned > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                <span className="font-semibold text-amber-800">Change to Return</span>
                <span className="font-heading font-bold text-xl text-amber-700">{formatCurrency(changeReturned)}</span>
              </div>
            )}
          </div>

          {/* Complete Sale Button */}
          <div className="p-6 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || isProcessing}
              className="w-full py-5 bg-store-green text-white font-heading font-bold text-xl rounded-2xl hover:bg-store-green-dark active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-store-green/30 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
              ) : (
                <><CheckCircle className="w-6 h-6" /> Complete Sale {cart.length > 0 && `· ${formatCurrency(grandTotal)}`}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="p-6">
              {/* Success header */}
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${completedSale.isOffline ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <CheckCircle className={`w-9 h-9 ${completedSale.isOffline ? 'text-amber-500' : 'text-store-green'}`} />
                </div>
                <h3 className="font-heading font-bold text-xl text-gray-800">Sale Complete!</h3>
                {completedSale.isOffline && (
                  <p className="text-amber-600 text-sm mt-1">⚠️ Saved offline — will sync when online</p>
                )}
              </div>

              {/* Receipt printable area */}
              <div className="receipt-printable bg-gray-50 rounded-xl p-4 font-mono text-sm space-y-1 mb-4">
                <div className="text-center mb-3">
                  <p className="font-bold text-base">🏪 GALIYAT STORE</p>
                  <p className="text-xs text-gray-500">Main Bazar, Galiyat</p>
                  <p className="text-xs text-gray-500">{formatDateTime(completedSale.createdAt)}</p>
                  <p className="text-xs">Invoice: {completedSale.invoiceNumber}</p>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                {completedSale.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-xs">
                    <span className="truncate pr-2">{item.product.name_en} x{item.qty}</span>
                    <span className="flex-shrink-0">{formatCurrency(item.qty * item.unitPrice)}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>{formatCurrency(completedSale.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>PAID ({completedSale.paymentMethod})</span>
                  <span>{formatCurrency(completedSale.amountPaid)}</span>
                </div>
                {completedSale.changeReturned > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>CHANGE</span>
                    <span>{formatCurrency(completedSale.changeReturned)}</span>
                  </div>
                )}
                <div className="text-center text-xs text-gray-400 mt-3 border-t border-dashed border-gray-300 pt-2">
                  Cashier: {user?.fullName}<br />
                  Thank you for shopping at Galiyat Store!<br />
                  آپ کا شکریہ
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={printReceipt} className="flex-1 py-3 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold hover:bg-gray-50 transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => { setCompletedSale(null); barcodeRef.current?.focus(); }}
                  className="flex-1 py-3 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark transition-colors"
                >
                  New Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StorageBadge({ type }: { type: string }) {
  const colors = {
    DRY: 'bg-amber-100 text-amber-700',
    CHILLED: 'bg-blue-100 text-blue-700',
    FROZEN: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}
