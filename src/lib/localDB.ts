import { supabase } from './supabase';

import { localInvoiceDB } from './invoiceDB';

export const generateId = () => crypto.randomUUID();

// Whitelist of valid database columns to protect against schema cache errors
const KNOWN_TABLE_COLUMNS: Record<string, Set<string>> = {
  jobs: new Set([
    'id', 'customer_id', 'bill_number', 'device_type', 'brand', 'model',
    'imei_serial_number', 'device_password_pin', 'accessories_received',
    'device_condition', 'complaint', 'technician_assigned', 'estimated_delivery_date',
    'status', 'billed_by', 'return_reason', 'return_reason_other', 'returnReason',
    'delivered_by', 'received_by', 'customer_signature', 'delivery_remarks',
    'spare_part_supplier', 'custom_warranty_days', 'display_changed', 'storage_box',
    'created_at', 'updated_at'
  ]),
  payments: new Set([
    'id', 'job_id', 'estimated_amount', 'advance_paid', 'amount_collected',
    'discount', 'tax_percentage', 'payment_method', 'payment_date',
    'split_cash', 'split_gpay', 'payment_status', 'balance_due',
    'created_at', 'updated_at'
  ]),
  warranties: new Set([
    'id', 'job_id', 'warranty_duration', 'warranty_start_date', 'warranty_expiry_date', 'warranty_status',
    'created_at', 'updated_at'
  ]),
  stock: new Set([
    'id', 'item', 'buyed_from', 'quantity', 'supported_model', 'box_no',
    'created_at', 'updated_at'
  ]),
  customers: new Set([
    'id', 'name', 'mobile_number', 'alternative_number', 'email', 'address',
    'gst_number', 'customer_notes', 'created_at', 'updated_at'
  ]),
  salaries: new Set([
    'id', 'staff_name', 'amount', 'payment_method', 'date', 'notes',
    'created_at', 'updated_at'
  ]),
  expenses: new Set([
    'id', 'type', 'description', 'amount', 'payment_method', 'date',
    'split_cash', 'split_gpay',
    'created_at', 'updated_at'
  ]),
  attendance: new Set([
    'id', 'staff_name', 'date', 'status', 'check_in_time', 'check_out_time',
    'notes', 'created_at', 'updated_at'
  ])
};

const extractMissingColumn = (errorMessage?: string): string | null => {
  if (!errorMessage) return null;
  const match = errorMessage.match(/Could not find the '([^']+)' column/i);
  return match ? match[1] : null;
};

const sanitizeItemForTable = (item: any, tableName: string, now: string) => {
  const allowed = KNOWN_TABLE_COLUMNS[tableName];
  const payload: Record<string, any> = {};

  if (allowed) {
    for (const key of Object.keys(item)) {
      if (allowed.has(key)) {
        payload[key] = item[key];
      }
    }
  } else {
    Object.assign(payload, item);
  }

  payload.created_at = item.created_at || now;
  payload.updated_at = item.updated_at || now;
  return payload;
};

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
    let sanitized = items.map((item: any) => sanitizeItemForTable(item, tableName, now));
    let { error } = await supabase.from(tableName).upsert(sanitized);
    if (error) {
      const missingCol = extractMissingColumn(error.message);
      if (missingCol) {
        console.warn(`Column '${missingCol}' missing in table '${tableName}'. Stripping and retrying save.`);
        KNOWN_TABLE_COLUMNS[tableName]?.delete(missingCol);
        sanitized = items.map((item: any) => {
          const s = sanitizeItemForTable(item, tableName, now);
          delete s[missingCol];
          return s;
        });
        const retryResult = await supabase.from(tableName).upsert(sanitized);
        if (!retryResult.error) return;
        error = retryResult.error;
      }
      console.error(`Error saving to ${tableName}:`, error);
      throw error;
    }
  },
  insert: async (item: any) => {
    const now = new Date().toISOString();
    let payload = sanitizeItemForTable(item, tableName, now);
    let { data, error } = await supabase.from(tableName).insert(payload).select().single();
    if (error) {
      const missingCol = extractMissingColumn(error.message);
      if (missingCol) {
        console.warn(`Column '${missingCol}' missing in table '${tableName}'. Stripping and retrying insert.`);
        KNOWN_TABLE_COLUMNS[tableName]?.delete(missingCol);
        delete payload[missingCol];
        const retryResult = await supabase.from(tableName).insert(payload).select().single();
        if (!retryResult.error) return retryResult.data;
        error = retryResult.error;
      }
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
    return data;
  },
  update: async (id: string, updates: any) => {
    const now = new Date().toISOString();
    const allowed = KNOWN_TABLE_COLUMNS[tableName];
    let payload: Record<string, any> = {};
    if (allowed) {
      for (const key of Object.keys(updates)) {
        if (allowed.has(key)) {
          payload[key] = updates[key];
        }
      }
    } else {
      Object.assign(payload, updates);
    }
    payload.updated_at = now;
    let { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select().maybeSingle();
    if (error) {
      const missingCol = extractMissingColumn(error.message);
      if (missingCol) {
        console.warn(`Column '${missingCol}' missing in table '${tableName}'. Stripping and retrying update.`);
        KNOWN_TABLE_COLUMNS[tableName]?.delete(missingCol);
        delete payload[missingCol];
        const retryResult = await supabase.from(tableName).update(payload).eq('id', id).select().maybeSingle();
        if (!retryResult.error) return retryResult.data;
        error = retryResult.error;
      }
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
