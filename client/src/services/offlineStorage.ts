import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LocationUpdate } from '../types.js';

interface OfflineDB extends DBSchema {
  pending_locations: {
    key: string;
    value: LocationUpdate & { localId: string };
    indexes: { 'by-trip': string; 'by-timestamp': string };
  };
}

const DB_NAME = 'CampusBusOfflineStorage';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending_locations')) {
          const store = db.createObjectStore('pending_locations', { keyPath: 'localId' });
          store.createIndex('by-trip', 'tripId');
          store.createIndex('by-timestamp', 'timestamp');
        }
      }
    });
  }
  return dbPromise;
}

export const offlineStorage = {
  /**
   * Save an unsent location update to IndexedDB
   */
  async enqueueLocation(location: LocationUpdate): Promise<string> {
    const db = await getOfflineDB();
    const localId = `off-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = { ...location, localId };

    await db.put('pending_locations', record);
    console.log(`[OfflineStorage] Enqueued location point. Total queued: ${await this.getPendingCount()}`);
    return localId;
  },

  /**
   * Retrieve all pending location updates ordered by timestamp
   */
  async getPendingLocations(): Promise<(LocationUpdate & { localId: string })[]> {
    const db = await getOfflineDB();
    const records = await db.getAll('pending_locations');
    // Sort chronologically
    return records.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  /**
   * Count total unsent locations
   */
  async getPendingCount(): Promise<number> {
    const db = await getOfflineDB();
    return db.count('pending_locations');
  },

  /**
   * Remove specified synchronized location updates from storage
   */
  async removePendingLocations(localIds: string[]): Promise<void> {
    const db = await getOfflineDB();
    const tx = db.transaction('pending_locations', 'readwrite');
    for (const id of localIds) {
      await tx.store.delete(id);
    }
    await tx.done;
    console.log(`[OfflineStorage] Removed ${localIds.length} synced locations from IndexedDB`);
  },

  /**
   * Clear all pending locations (e.g. after full sync)
   */
  async clearPendingLocations(): Promise<void> {
    const db = await getOfflineDB();
    await db.clear('pending_locations');
  }
};
