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
  // Fallire qui con un messaggio esplicito: senza questo controllo una env
  // mancante diventa un criptico "supabaseUrl is required" o, se la variabile
  // c'è ma è sbagliata, un "TypeError: fetch failed" indistinguibile da un
  // problema di rete.
  const mancanti = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !process.env.SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
  ].filter(Boolean)
  if (mancanti.length > 0) {
    throw new Error(`Supabase non configurato: manca ${mancanti.join(', ')}`)
  }

  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_KEY!,
    noCache
  )
}
