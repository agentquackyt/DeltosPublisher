type StorageValue = string | null;

type StorageAdapter = {
    getItem: (key: string) => StorageValue;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

const createMemoryStorage = (): StorageAdapter => {
    const store = new Map<string, string>();

    return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => {
            store.set(key, value);
        },
        removeItem: (key) => {
            store.delete(key);
        },
    };
};

const resolveStorage = (): StorageAdapter => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Ignore storage access errors and fall back to memory.
    }

    return createMemoryStorage();
};

const storage = resolveStorage();

const getJSON = <T>(key: string): T | null => {
    const raw = storage.getItem(key);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

let lastQuotaAlert = 0;

const setJSON = (key: string, value: unknown) => {
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch (e: any) {
        if (e?.name === 'QuotaExceededError') {
            console.error('Storage quota exceeded when setting key:', key);
            const now = Date.now();
            if (now - lastQuotaAlert > 5000) {
                lastQuotaAlert = now;
                alert('Storage limit reached! Your recent changes could not be saved. Please remove some large images or create a new project.');
            }
        } else {
            throw e;
        }
    }
};

export type { StorageAdapter };
export { storage, getJSON, setJSON };

// IndexedDB Async Storage for large assets
export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DeltosPublisherDB', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('keyval')) {
                db.createObjectStore('keyval');
            }
        };

        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
};

export const idbSet = async (key: string, value: any): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const idbGet = async <T>(key: string): Promise<T | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyval', 'readonly');
        const store = transaction.objectStore('keyval');
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
        request.onerror = () => reject(request.error);
    });
};

export const idbRemove = async (key: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

