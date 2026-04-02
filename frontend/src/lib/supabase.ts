import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Opzioni no-cache per evitare che Next.js 14 metta in cache le fetch di Supabase
const noCache = {
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) =>
      fetch(url, { ...options, cache: 'no-store' }),
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, noCache)

// Client con service role per operazioni server-side
export function getServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_KEY!,
    noCache
  )
}
