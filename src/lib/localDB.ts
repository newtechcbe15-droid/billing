import { supabase } from './supabase';

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
  }
});

export const localDB = {
  customers: createSupabaseHelper('customers'),
  jobs: createSupabaseHelper('jobs'),
  payments: createSupabaseHelper('payments'),
  warranties: createSupabaseHelper('warranties'),
  expenses: createSupabaseHelper('expenses'),
  salaries: createSupabaseHelper('salaries'),
  settings: {
    get: async () => {
      const { data, error } = await supabase.from('settings').select('*').single();
      if (error || !data) {
        return { next_bill_number: 1 };
      }
      return data;
    },
    save: async (data: any) => {
      const { error } = await supabase.from('settings').upsert({ id: 'global', ...data });
      if (error) {
        console.error('Error saving settings:', error);
        throw error;
      }
    }
  }
};
