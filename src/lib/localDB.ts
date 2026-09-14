import { supabase } from './supabase';

import { localInvoiceDB } from './invoiceDB';

export const generateId = () => crypto.randomUUID();

// Helper to interact with Supabase
const createSupabaseHelper = (tableName: string) => ({
  getAll: async () => {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`Error fetching from ${tableName}:`, error);
      return [];
    }
    return data || [];
  },
  save: async (items: any[]) => {
    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    const sanitized = items.map((item: any) => ({
      ...item,
      created_at: item.created_at || now,
      updated_at: item.updated_at || now,
    }));
    const { error } = await supabase.from(tableName).upsert(sanitized);
    if (error) {
      console.error(`Error saving to ${tableName}:`, error);
      throw error;
    }
  },
  insert: async (item: any) => {
    const now = new Date().toISOString();
    const payload = {
      ...item,
      created_at: item.created_at || now,
      updated_at: item.updated_at || now,
    };
    const { data, error } = await supabase.from(tableName).insert(payload).select().single();
    if (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
    return data;
  },
  update: async (id: string, updates: any) => {
    const now = new Date().toISOString();
    const payload = {
      ...updates,
      updated_at: now,
    };
    const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select().maybeSingle();
    if (error) {
      console.error(`Error updating in ${tableName}:`, error);
      throw error;
    }
    return data;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting from ${tableName}:`, error);
      throw error;
    }
  }
});

const LOCAL_STORAGE_ATTENDANCE_KEY = 'ntcs_local_attendance';

const createAttendanceHelper = () => {
  const getLocal = (): any[] => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn("Failed to read local attendance:", e);
      return [];
    }
  };

  const setLocal = (items: any[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local attendance:", e);
    }
  };

  return {
    getAll: async () => {
      try {
        const { data, error } = await supabase.from('attendance').select('*');
        if (error) {
          console.warn("Supabase attendance fetch failed, using local storage:", error.message);
          return getLocal();
        }
        if (data && data.length > 0) {
          setLocal(data);
          return data;
        }
        return getLocal();
      } catch (e) {
        console.warn("Attendance getAll network error, using local fallback:", e);
        return getLocal();
      }
    },
    save: async (items: any[]) => {
      setLocal(items);
      try {
        const { error } = await supabase.from('attendance').upsert(items);
        if (error) {
          console.warn("Supabase attendance save failed, kept locally:", error.message);
        }
      } catch (e) {
        console.warn("Supabase attendance save error:", e);
      }
    },
    insert: async (item: any) => {
      const current = getLocal();
      current.push(item);
      setLocal(current);
      try {
        const { data, error } = await supabase.from('attendance').insert(item).select().single();
        if (error) {
          console.warn("Supabase attendance insert failed, kept locally:", error.message);
          return item;
        }
        return data || item;
      } catch (e) {
        return item;
      }
    },
    update: async (id: string, updates: any) => {
      const current = getLocal();
      const idx = current.findIndex(i => i.id === id);
      if (idx > -1) {
        current[idx] = { ...current[idx], ...updates };
        setLocal(current);
      }
      try {
        const { data, error } = await supabase.from('attendance').update(updates).eq('id', id).select().maybeSingle();
        if (error) {
          console.warn("Supabase attendance update failed, kept locally:", error.message);
          return current[idx];
        }
        return data || current[idx];
      } catch (e) {
        return current[idx];
      }
    },
    delete: async (id: string) => {
      const current = getLocal().filter(i => i.id !== id);
      setLocal(current);
      try {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) {
          console.warn("Supabase attendance delete failed, removed locally:", error.message);
        }
      } catch (e) {
        console.warn("Supabase attendance delete error:", e);
      }
    }
  };
};

export const localDB = {
  customers: createSupabaseHelper('customers'),
  jobs: createSupabaseHelper('jobs'),
  payments: createSupabaseHelper('payments'),
  warranties: createSupabaseHelper('warranties'),
  expenses: createSupabaseHelper('expenses'),
  salaries: createSupabaseHelper('salaries'),
  stock: createSupabaseHelper('stock'),
  inventory: createSupabaseHelper('stock'),
  attendance: createAttendanceHelper(),
  // Local Database for Invoices only - completely independent from Supabase
  invoices: localInvoiceDB,
  settings: {
    get: async () => {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      if (error || !data) {
        return { id: 'global', next_bill_number: 1, next_invoice_number: 1 };
      }
      return data;
    },
    save: async (data: any) => {
      // Ensure id is always 'global' and don't spread potentially conflicting read-only fields if unnecessary
      const payload = { ...data, id: 'global' };
      const { error } = await supabase.from('settings').upsert(payload);
      if (error) {
        console.error('Error saving settings:', error);
        throw error;
      }
    }
  }
};
