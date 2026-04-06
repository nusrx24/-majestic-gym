import { createClient } from '@supabase/supabase-js';

// I am directly providing the fallback keys since your .env.local file was blocked from saving
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iwhnmedzxcazklyqeacc.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3aG5tZWR6eGNhemtseXFlYWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjMwNDYsImV4cCI6MjA5MDY5OTA0Nn0.2okIzAZxqak_JjRoLfv-TFQJKuFA9BtBOgy_Uq8FG8o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
