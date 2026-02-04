/**
 * @fileoverview IndexedDB Database Definition
 * @description Defines rr database schema and initialization logic
 */

/** Database Name */
export const RR_DB_NAME = 'record_replay';

/** Database Version */
export const RR_DB_VERSION = 1;

/**
 * Store Name Constants
 */
export const RR_STORES = {
  FLOWS: 'flows',
  RUNS: 'runs',
  EVENTS: 'events',
  QUEUE: 'queue',
  PERSISTENT_VARS: 'persistent_vars',
  TRIGGERS: 'triggers',
} as const;

/**
 * Store Configuration
 */
export interface StoreConfig {
  keyPath: string | string[];
  autoIncrement?: boolean;
  indexes?: Array<{
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
  }>;
}

/**
 * Store Schema Definition
 * @description Contains all indexes needed for Phase 1-3 to avoid future upgrades
 */
export const RR_STORE_SCHEMAS: Record<string, StoreConfig> = {
  [RR_STORES.FLOWS]: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keyPath: 'name' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
  [RR_STORES.RUNS]: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'flowId', keyPath: 'flowId' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      // Compound index for listing runs by flow and status
      { name: 'flowId_status', keyPath: ['flowId', 'status'] },
    ],
  },
  [RR_STORES.EVENTS]: {
    keyPath: ['runId', 'seq'],
    indexes: [
      { name: 'runId', keyPath: 'runId' },
      { name: 'type', keyPath: 'type' },
      // Compound index for filtering events by run and type
      { name: 'runId_type', keyPath: ['runId', 'type'] },
    ],
  },
  [RR_STORES.QUEUE]: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'priority', keyPath: 'priority' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'flowId', keyPath: 'flowId' },
      // Phase 3: Used by claimNext(); cursor direction + key ranges implement priority DESC + createdAt ASC.
      { name: 'status_priority_createdAt', keyPath: ['status', 'priority', 'createdAt'] },
      // Phase 3: Lease expiration tracking
      { name: 'lease_expiresAt', keyPath: 'lease.expiresAt' },
    ],
  },
  [RR_STORES.PERSISTENT_VARS]: {
    keyPath: 'key',
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
  },
  [RR_STORES.TRIGGERS]: {
    keyPath: 'id',
    indexes: [
      { name: 'kind', keyPath: 'kind' },
      { name: 'flowId', keyPath: 'flowId' },
      { name: 'enabled', keyPath: 'enabled' },
      // Compound index for listing enabled triggers by kind
      { name: 'kind_enabled', keyPath: ['kind', 'enabled'] },
    ],
  },
};

/**
 * Database Upgrade Handler
 */
export function handleUpgrade(db: IDBDatabase, oldVersion: number, _newVersion: number): void {
  // Version 0 -> 1: Create all stores
  if (oldVersion < 1) {
    for (const [storeName, config] of Object.entries(RR_STORE_SCHEMAS)) {
      const store = db.createObjectStore(storeName, {
        keyPath: config.keyPath,
        autoIncrement: config.autoIncrement,
      });

      // Create indexes
      if (config.indexes) {
        for (const index of config.indexes) {
          store.createIndex(index.name, index.keyPath, index.options);
        }
      }
    }
  }
}

/** Global Database Instance */
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open Database
 * @description Singleton pattern, ensures only one database connection
 */
export async function openRrDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(RR_DB_NAME, RR_DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle version change (other tab upgraded database)
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion ?? RR_DB_VERSION;
      handleUpgrade(db, oldVersion, newVersion);
    };
  });

  return dbPromise;
}

/**
 * Close database connection
 * @description Primarily for testing
 */
export function closeRrDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

/**
 * Delete database
 * @description Primarily for testing
 */
export async function deleteRrDb(): Promise<void> {
  closeRrDb();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(RR_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Execute Transaction
 * @param storeNames Store Names (single or multiple)
 * @param mode Transaction Mode
 * @param callback Transaction Callback
 */
export async function withTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => Promise<T> | T,
): Promise<T> {
  const db = await openRrDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);

  const stores: Record<string, IDBObjectStore> = {};
  for (const name of names) {
    stores[name] = tx.objectStore(name);
  }

  return new Promise<T>((resolve, reject) => {
    let result: T;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

    Promise.resolve(callback(stores))
      .then((r) => {
        result = r;
      })
      .catch((err) => {
        tx.abort();
        reject(err);
      });
  });
}
