import { useState, useEffect, useCallback } from 'react';
import { productCache, offlineSalesQueue, syncMeta } from '../lib/db';
import { productApi, syncApi, saleApi, Product, CreateSalePayload } from '../lib/api';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useProductSearch() {
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isOnline = useOnlineStatus();

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setResults([]); return; }
    setIsLoading(true);
    try {
      if (isOnline) {
        const products = await productApi.getAll({ search: query });
        setResults(products.slice(0, 20));
      } else {
        const cached = await productCache.search(query);
        setResults(cached.slice(0, 20));
      }
    } catch {
      // Fallback to cache
      const cached = await productCache.search(query);
      setResults(cached);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  const getByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    try {
      if (isOnline) {
        return await productApi.getByBarcode(barcode);
      } else {
        return (await productCache.getByBarcode(barcode)) || null;
      }
    } catch {
      return (await productCache.getByBarcode(barcode)) || null;
    }
  }, [isOnline]);

  return { results, isLoading, search, getByBarcode };
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  const updatePendingCount = useCallback(async () => {
    const count = await offlineSalesQueue.count();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const submitSale = useCallback(async (payload: CreateSalePayload): Promise<{ invoiceNumber?: string; offline?: boolean }> => {
    if (isOnline) {
      const sale = await saleApi.create(payload);
      return { invoiceNumber: sale.invoice_number };
    } else {
      const offlineId = await offlineSalesQueue.enqueue(payload);
      await updatePendingCount();
      return { offline: true, invoiceNumber: offlineId };
    }
  }, [isOnline, updatePendingCount]);

  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const pending = await offlineSalesQueue.getPending();
      for (const item of pending) {
        try {
          await saleApi.create({ ...item.payload, channel: 'OFFLINE_SYNCED' });
          await offlineSalesQueue.markSynced(item.id);
        } catch (err) {
          console.error('Failed to sync sale:', item.id, err);
        }
      }
      await updatePendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  const syncProductCache = useCallback(async () => {
    if (!isOnline) return;
    try {
      const since = await syncMeta.getLastSyncAt();
      const { products, syncedAt } = await syncApi.pull(since || undefined);
      if (products.length > 0) {
        await productCache.saveAll(products);
      }
      await syncMeta.setLastSyncAt(syncedAt);
    } catch (err) {
      console.error('Failed to sync product cache:', err);
    }
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPending();
    }
    if (isOnline) {
      syncProductCache();
    }
  }, [isOnline, pendingCount, syncPending, syncProductCache]);

  return { pendingCount, isSyncing, submitSale, syncPending };
}
