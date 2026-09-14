export interface InvoiceItem {
  id: number | string;
  name: string;
  desc?: string;
  qty: number;
  unit: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  client_name: string;
  role?: string;
  date: string;
  gst_percent?: number;
  items: InvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

const DB_NAME = 'ntcs_billing_invoices_db';
const DB_VERSION = 1;
const INVOICE_STORE = 'invoices';
const SETTINGS_STORE = 'settings';
const LOCAL_STORAGE_INVOICES_KEY = 'ntcs_local_invoices';
const LOCAL_STORAGE_SETTINGS_KEY = 'ntcs_local_invoice_settings';

// Check if IndexedDB is available
const isIndexedDBAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
};

// Open or get IndexedDB connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INVOICE_STORE)) {
        db.createObjectStore(INVOICE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Fallback helpers for localStorage
const getLocalStorageInvoices = (): Invoice[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_INVOICES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const setLocalStorageInvoices = (invoices: Invoice[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_INVOICES_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.warn('Failed to write invoices to localStorage fallback:', err);
  }
};

const getLocalStorageSettings = (): { next_invoice_number: number } => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    return data ? JSON.parse(data) : { next_invoice_number: 1 };
  } catch {
    return { next_invoice_number: 1 };
  }
};

const setLocalStorageSettings = (settings: { next_invoice_number: number }): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to write invoice settings to localStorage fallback:', err);
  }
};

export const localInvoiceDB = {
  /**
   * Retrieve all saved invoices, sorted newest first
   */
  getAll: async (): Promise<Invoice[]> => {
    try {
      const db = await openDB();
      return await new Promise<Invoice[]>((resolve, reject) => {
        const tx = db.transaction(INVOICE_STORE, 'readonly');
        const store = tx.objectStore(INVOICE_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          const invoices: Invoice[] = request.result || [];
          // Sort by updated_at or created_at or invoice_no descending
          invoices.sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || a.date).getTime() || 0;
            const timeB = new Date(b.updated_at || b.created_at || b.date).getTime() || 0;
            return timeB - timeA;
          });
          resolve(invoices);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback to localStorage
      const invoices = getLocalStorageInvoices();
      invoices.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || a.date).getTime() || 0;
        const timeB = new Date(b.updated_at || b.created_at || b.date).getTime() || 0;
        return timeB - timeA;
      });
      return invoices;
    }
  },

  /**
   * Retrieve an invoice by its ID
   */
  getById: async (id: string): Promise<Invoice | null> => {
    try {
      const db = await openDB();
      return await new Promise<Invoice | null>((resolve, reject) => {
        const tx = db.transaction(INVOICE_STORE, 'readonly');
        const store = tx.objectStore(INVOICE_STORE);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const invoices = getLocalStorageInvoices();
      return invoices.find((inv) => inv.id === id) || null;
    }
  },

  /**
   * Save or update invoices locally
   */
  save: async (items: Invoice | Invoice[]): Promise<void> => {
    const list = Array.isArray(items) ? items : [items];
    if (list.length === 0) return;

    const now = new Date().toISOString();
    const preparedList = list.map((inv) => ({
      ...inv,
      updated_at: now,
      created_at: inv.created_at || now,
    }));

    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(INVOICE_STORE, 'readwrite');
        const store = tx.objectStore(INVOICE_STORE);

        preparedList.forEach((inv) => store.put(inv));

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Fallback
      const current = getLocalStorageInvoices();
      const currentMap = new Map<string, Invoice>(current.map((i) => [i.id, i]));
      preparedList.forEach((inv) => currentMap.set(inv.id, inv));
      setLocalStorageInvoices(Array.from(currentMap.values()));
    }
  },

  /**
   * Delete an invoice by its ID
   */
  delete: async (id: string): Promise<void> => {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(INVOICE_STORE, 'readwrite');
        const store = tx.objectStore(INVOICE_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const current = getLocalStorageInvoices().filter((inv) => inv.id !== id);
      setLocalStorageInvoices(current);
    }
  },

  /**
   * Get the next invoice sequence number
   */
  getNextInvoiceNumber: async (): Promise<number> => {
    let nextNo = 1;
    try {
      const db = await openDB();
      const stored = await new Promise<{ key: string; value: number } | null>((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get('next_invoice_number');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (stored && typeof stored.value === 'number') {
        nextNo = stored.value;
      } else {
        // Derive from highest existing invoice_no if available
        const all = await localInvoiceDB.getAll();
        const maxNo = all.reduce((max, inv) => {
          const parsed = parseInt(inv.invoice_no, 10);
          return !isNaN(parsed) && parsed > max ? parsed : max;
        }, 0);
        nextNo = maxNo + 1;
      }
    } catch {
      const settings = getLocalStorageSettings();
      nextNo = settings.next_invoice_number || 1;
    }

    return nextNo;
  },

  /**
   * Increment and save the next invoice sequence number
   */
  incrementInvoiceNumber: async (): Promise<number> => {
    const current = await localInvoiceDB.getNextInvoiceNumber();
    const next = current + 1;

    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        store.put({ key: 'next_invoice_number', value: next });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      setLocalStorageSettings({ next_invoice_number: next });
    }

    return next;
  },
};
