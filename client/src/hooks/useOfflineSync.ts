import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage } from '../services/offlineStorage.js';
import { api } from '../services/api.js';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  // Sync queued offline items to server
  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    try {
      isSyncingRef.current = true;
      setIsSyncing(true);

      const pending = await offlineStorage.getPendingLocations();
      if (pending.length === 0) {
        setIsSyncing(false);
        isSyncingRef.current = false;
        return;
      }

      console.log(`[useOfflineSync] Starting batch synchronization for ${pending.length} items...`);

      // Strip localId before sending to backend
      const updates = pending.map(({ localId, ...rest }) => rest);

      const res = await api.post('/location/batch', { updates });

      if (res.success) {
        const localIds = pending.map(p => p.localId);
        await offlineStorage.removePendingLocations(localIds);
        setLastSyncTime(new Date());
        console.log(`[useOfflineSync] Batch sync successful! Synced: ${res.processedCount}`);
      }
    } catch (err: any) {
      console.warn('[useOfflineSync] Sync failed, will retry when network stabilizes:', err.message);
    } finally {
      await refreshPendingCount();
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      console.log('🌐 Network status changed: ONLINE');
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      console.log('📡 Network status changed: OFFLINE');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check for pending points and sync
    const interval = setInterval(() => {
      refreshPendingCount().then(count => {
        if (count > 0 && navigator.onLine) {
          triggerSync();
        }
      });
    }, 6000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    triggerSync,
    refreshPendingCount
  };
}
