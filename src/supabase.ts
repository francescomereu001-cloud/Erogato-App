import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://tx1pkdkvutibhhsufgv1o.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_c-BDahL4GOyT_FQTfsIPeA_fyu9jjEz';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
