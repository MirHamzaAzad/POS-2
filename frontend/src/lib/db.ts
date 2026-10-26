import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Product, CreateSalePayload } from './api';

interface PosDB extends DBSchema {
  cached_products: {
    key: string;
    value: Product & { cached_at: number };
    indexes: { 'by-barcode': string; 'by-sku': string };
  };
  offline_sales: {
    key: string;
    value: { id: string; payload: CreateSalePayload; created_at: number; synced: boolean };
  };
  sync_status: {
    key: string;
    value: { key: string; value: string };
  };
}

let db: IDBPDatabase<PosDB> | null = null;

export async function initDB(): Promise<void> {
  db = await openDB<PosDB>('galiyat-pos-db', 1, {
    upgrade(database) {
      // Products cache
      const productStore = database.createObjectStore('cached_products', { keyPath: 'id' });
      productStore.createIndex('by-barcode', 'barcode');
      productStore.createIndex('by-sku', 'sku');

      // Offline sales queue
      database.createObjectStore('offline_sales', { keyPath: 'id' });

      // Sync metadata
      database.createObjectStore('sync_status', { keyPath: 'key' });
    },
  });
}

function getDB(): IDBPDatabase<PosDB> {
  if (!db) throw new Error('IndexedDB not initialized');
  return db;
}

// Product cache
export const productCache = {
  async saveAll(products: Product[]): Promise<void> {
    const database = getDB();
    const tx = database.transaction('cached_products', 'readwrite');
    await Promise.all([
      ...products.map((p) => tx.store.put({ ...p, cached_at: Date.now() })),
      tx.done,
    ]);
  },

  async getAll(): Promise<Product[]> {
    return getDB().getAll('cached_products');
  },

  async getByBarcode(barcode: string): Promise<Product | undefined> {
    return getDB().getFromIndex('cached_products', 'by-barcode', barcode);
  },

  async getBySku(sku: string): Promise<Product | undefined> {
    return getDB().getFromIndex('cached_products', 'by-sku', sku);
  },

  async search(query: string): Promise<Product[]> {
    const all = await getDB().getAll('cached_products');
    const q = query.toLowerCase();
    return all.filter(
      (p) =>
        p.name_en.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
    );
  },
};

// Offline sales queue
export const offlineSalesQueue = {
  async enqueue(payload: CreateSalePayload): Promise<string> {
    const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const salePayload = { ...payload, clientTransactionId: id, channel: 'OFFLINE_SYNCED' as const };
    await getDB().put('offline_sales', {
      id,
      payload: salePayload,
      created_at: Date.now(),
      synced: false,
    });
    return id;
  },

  async getPending(): Promise<Array<{ id: string; payload: CreateSalePayload }>> {
    const all = await getDB().getAll('offline_sales');
    return all.filter((s) => !s.synced);
  },

  async markSynced(id: string): Promise<void> {
    const item = await getDB().get('offline_sales', id);
    if (item) {
      await getDB().put('offline_sales', { ...item, synced: true });
    }
  },

  async count(): Promise<number> {
    const pending = await this.getPending();
    return pending.length;
  },
};

// Sync metadata
export const syncMeta = {
  async getLastSyncAt(): Promise<string | null> {
    const entry = await getDB().get('sync_status', 'last_sync_at');
    return entry?.value || null;
  },

  async setLastSyncAt(ts: string): Promise<void> {
    await getDB().put('sync_status', { key: 'last_sync_at', value: ts });
  },
};
