import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rliieyvvtnxcgrmckvaf.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LLi15NT_XD8R9NyQAi_gMg_506LeFp7'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
