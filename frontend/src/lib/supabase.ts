import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let lastReachabilityCheckAt = 0;
let lastReachabilityResult = true;

export async function canReachSupabaseAuth(timeoutMs = 4000): Promise<boolean> {
  const now = Date.now();
  if (now - lastReachabilityCheckAt < 15000) {
    return lastReachabilityResult;
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    const healthUrl = `${supabaseUrl}/auth/v1/health`;
    const res = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    window.clearTimeout(timer);
    lastReachabilityResult = res.ok;
  } catch {
    lastReachabilityResult = false;
  }

  lastReachabilityCheckAt = now;
  return lastReachabilityResult;
}
