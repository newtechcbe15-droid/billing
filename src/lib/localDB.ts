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
    const { error } = await supabase.from(tableName).upsert(items);
    if (error) {
      console.error(`Error saving to ${tableName}:`, error);
      throw error;
    }
  },
  insert: async (item: any) => {
    const { data, error } = await supabase.from(tableName).insert(item).select().single();
    if (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
    return data;
  },
  update: async (id: string, updates: any) => {
    const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select().maybeSingle();
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

export const localDB = {
  customers: createSupabaseHelper('customers'),
  jobs: createSupabaseHelper('jobs'),
  payments: createSupabaseHelper('payments'),
  warranties: createSupabaseHelper('warranties'),
  expenses: createSupabaseHelper('expenses'),
  salaries: createSupabaseHelper('salaries'),
  stock: createSupabaseHelper('stock'),
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
