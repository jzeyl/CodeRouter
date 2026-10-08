import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let publicClient: SupabaseClient | undefined
let adminClient: SupabaseClient | undefined
export function supabaseConfiguration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key)
    throw new Error(
      'Supabase is not configured. Ask the project owner to set the project URL and publishable key.',
    )
  if (!key.startsWith('sb_publishable_'))
    throw new Error(
      'Use a Supabase publishable key for this frontend. Secret and service-role keys are not supported.',
    )
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('The Supabase project URL must use HTTPS.')
  return { url: parsed.origin, key }
}
export function getPublicClient() {
  const { url, key } = supabaseConfiguration()
  // Public searches never inherit an administrator's session or draft visibility.
  return (publicClient ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'moveon-public',
    },
  }))
}
export function getAdminClient() {
  const { url, key } = supabaseConfiguration()
  return (adminClient ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'moveon-admin-session',
    },
  }))
}
