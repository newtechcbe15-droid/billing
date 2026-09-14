import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://esvjjvjkjvpjszhoeous.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_hLDRenj8e-EsJ59_bEvipA_D0RpjI-R";

const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);



