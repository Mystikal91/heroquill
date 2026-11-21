/** Minimal promise wrapper over IndexedDB: a few object stores, no dependencies. */

const DB_NAME = "dnd-character-maker";
const DB_VERSION = 5;

export type StoreName =
  | "characters"
  | "meta"
  | "packs"
  | "translations"
  | "encounters"
  | "campaigns";

let connection: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("characters"))
        db.createObjectStore("characters", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("translations")) db.createObjectStore("translations");
      // The fights of the Dungeon Master mode (version 4).
      if (!db.objectStoreNames.contains("encounters"))
        db.createObjectStore("encounters", { keyPath: "id" });
      // The campaigns of the Dungeon Master mode, with their parties (version 5).
      if (!db.objectStoreNames.contains("campaigns"))
        db.createObjectStore("campaigns", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // A newer version of the app in another tab wants to upgrade the database: let go, or it would wait for this tab to close.
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open the database"));
    request.onblocked = () => reject(new Error("The database is blocked by another tab"));
  });
  // A failed attempt must not be cached forever.
  connection.catch(() => {
    connection = undefined;
  });
  return connection;
}

/** Runs one request in its own transaction and resolves when the transaction commits. */
async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
  });
}

export const dbGet = <T>(store: StoreName, key: IDBValidKey) =>
  run<T | undefined>(store, "readonly", (s) => s.get(key));

export const dbGetAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll());

export const dbPut = (store: StoreName, value: unknown, key?: IDBValidKey) =>
  run(store, "readwrite", (s) => s.put(value, key));

export const dbDelete = (store: StoreName, key: IDBValidKey) =>
  run(store, "readwrite", (s) => s.delete(key));

/** Every key and value of a store, for caches that are kept in memory. */
export async function dbEntries<T>(store: StoreName): Promise<[string, T][]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const entries: [string, T][] = [];
    const request = db.transaction(store, "readonly").objectStore(store).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(entries);
      entries.push([String(cursor.key), cursor.value as T]);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export const dbClear = (store: StoreName) => run(store, "readwrite", (s) => s.clear());
