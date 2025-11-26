import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lswamyafjbdpmnukbjld.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzd2FteWFmamJkcG1udWtiamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNjM1MzcsImV4cCI6MjA3OTYzOTUzN30.zdQ1I24QhH1Qip3zqjS_EjNlzWtOqsZqeesEdUtc4ls';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
  },
});

