// Supabase browser client for the Gooodboys workspace.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqjlolcsgqyqkpjwebje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxamxvbGNzZ3F5cWtwandlYmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODk5NTcsImV4cCI6MjA5MzU2NTk1N30.-onfK-2nJKkMoT8sgvTjUxYTeHUfaOA6rwiVDYLV9kQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
