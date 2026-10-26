const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const api = new ApiClient(API_BASE);

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: User }>('/api/auth/login', { username, password }),
  me: () => api.get<User>('/api/auth/me'),
};

// Products
export const productApi = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<Product[]>(`/api/products${q}`);
  },
  getByBarcode: (code: string) => api.get<Product>(`/api/products/barcode/${code}`),
  create: (data: Partial<Product>) => api.post<Product>('/api/products', data),
  update: (id: string, data: Partial<Product>) => api.put<Product>(`/api/products/${id}`, data),
};

// Categories
export const categoryApi = {
  getAll: () => api.get<Category[]>('/api/categories'),
  create: (data: { name: string; parentId?: string }) => api.post<Category>('/api/categories', data),
};

// Suppliers
export const supplierApi = {
  getAll: () => api.get<Supplier[]>('/api/suppliers'),
};

// Units
export const unitApi = {
  getAll: () => api.get<Unit[]>('/api/units'),
};

// Sales
export const saleApi = {
  create: (data: CreateSalePayload) => api.post<Sale>('/api/sales', data),
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<Sale[]>(`/api/sales${q}`);
  },
  getById: (id: string) => api.get<Sale>(`/api/sales/${id}`),
  void: (id: string, reason: string) => api.post(`/api/sales/${id}/void`, { reason }),
  return: (id: string, items: ReturnItem[], reason: string) =>
    api.post(`/api/sales/${id}/return`, { items, reason }),
};

// Inventory
export const inventoryApi = {
  getBalances: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<InventoryBalance[]>(`/api/inventory/balances${q}`);
  },
  adjust: (data: StockAdjustPayload) => api.post('/api/inventory/adjust', data),
  receiveGoods: (data: ReceiveGoodsPayload) => api.post('/api/inventory/receive', data),
  getMovements: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<InventoryMovement[]>(`/api/inventory/movements${q}`);
  },
};

// Reports
export const reportApi = {
  daily: (date?: string, branchId?: string) => {
    const q = new URLSearchParams();
    if (date) q.set('date', date);
    if (branchId) q.set('branchId', branchId);
    return api.get<DailyReport>(`/api/reports/daily?${q}`);
  },
  cashier: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<CashierReport[]>(`/api/reports/cashier${q}`);
  },
  stock: () => api.get<StockReport[]>('/api/reports/stock'),
};

// Sync
export const syncApi = {
  pull: (since?: string) => api.get<{ products: Product[]; prices: unknown[]; syncedAt: string }>(`/api/sync/pull${since ? `?since=${since}` : ''}`),
  push: (transactions: unknown[]) => api.post('/api/sync/push', { transactions }),
};

// Types
export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone: string;
  roles: string[];
  permissions: string[];
  branch?: { id: string; name: string };
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name_en: string;
  name_ur?: string;
  storage_type: 'DRY' | 'CHILLED' | 'FROZEN';
  track_expiry: boolean;
  is_active: boolean;
  category?: Category;
  unit?: Unit;
  brand?: Brand;
  prices?: ProductPrice[];
  inventory_bals?: InventoryBalance[];
}

export interface ProductPrice {
  id: string;
  retail_price: number;
  purchase_cost: number;
  margin_amount: number;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  children?: Category[];
}

export interface Brand { id: string; name: string; }
export interface Unit { id: string; code: string; name: string; }
export interface Supplier { id: string; name: string; phone: string; email?: string; }

export interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
}

export interface CreateSalePayload {
  branchId: string;
  items: Array<{ productId: string; qty: number; unitPrice: number; discountAmount: number; taxAmount: number }>;
  discountTotal: number;
  taxTotal: number;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CARD' | 'WALLET' | 'MIXED';
  paymentReference?: string;
  channel?: 'POS' | 'OFFLINE_SYNCED';
  clientTransactionId?: string;
}

export interface Sale {
  id: string;
  invoice_number: string;
  sale_status: string;
  grand_total: number;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  amount_paid: number;
  change_returned: number;
  created_at: string;
  items: SaleItem[];
  payments: Payment[];
  cashier?: { full_name: string };
}

export interface SaleItem {
  id: string;
  product_name_snapshot: string;
  barcode_snapshot?: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

export interface Payment {
  id: string;
  payment_method: string;
  amount: number;
  payment_status: string;
}

export interface ReturnItem { productId: string; qty: number; unitRefundPrice: number; }

export interface InventoryBalance {
  id: string;
  branch_id: string;
  product_id: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  reorder_level: number;
  reorder_qty: number;
  product?: Product;
}

export interface InventoryMovement {
  id: string;
  movement_type: string;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  notes?: string;
  created_at: string;
  product?: { name_en: string; sku: string };
}

export interface StockAdjustPayload {
  branchId: string;
  productId: string;
  adjustmentType: 'INCREMENT' | 'DECREMENT' | 'SET';
  qty: number;
  reason: string;
  movementType?: string;
}

export interface ReceiveGoodsPayload {
  branchId: string;
  supplierId: string;
  poId?: string;
  items: Array<{ productId: string; qty: number; unitCost: number; batchNumber?: string; expiryDate?: string }>;
}

export interface DailyReport {
  date: string;
  totalTransactions: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalDiscount: number;
  totalRefunds: number;
  netSales: number;
  topProducts: Array<{ productId: string; name: string; qty: number; revenue: number }>;
}

export interface CashierReport { cashierId: string; name: string; transactions: number; total: number; }
export interface StockReport {
  productId: string; sku: string; name: string; category: string;
  unit: string; onHandQty: number; reorderLevel: number;
  isLowStock: boolean; retailPrice: number; stockValue: number;
}
