'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Support both old anon key format and new Supabase v2 publishable key format
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

// Use a module-level singleton to prevent multiple GoTrueClient instances
// (Next.js hot module replacement can re-execute module code)
let _supabase = null;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'btcfinder-auth',
      },
    });
  }
  return _supabase;
}

export const supabase = getSupabaseClient();

/**
 * Returns true if Supabase configuration variables are active
 */
export function isDbEnabled() {
  return !!supabase;
}
