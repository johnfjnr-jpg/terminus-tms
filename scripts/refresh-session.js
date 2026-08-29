// Refresh session-ref.json from its own refresh token. Round 38.
//
// The HTTP probes need a live access token, and an expired one fails the merge
// gate as a FAILED stage rather than a skipped one, which is correct and also
// means the gate stops until somebody signs in again. sign-in.js needs the
// password; this needs nothing but the refresh token already on disk, so the
// gate's prerequisite can be restored without a credential being typed anywhere.
//
// If the refresh token has also expired, this fails loudly and sign-in.js is the
// answer. It does not fall back to anything.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const PATH = new URL('../session-ref.json', import.meta.url).pathname
const session = JSON.parse(readFileSync(PATH, 'utf8'))

const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
if (!url || !anon) {
  console.error('SUPABASE_URL and an anon/publishable key are required. Run with --env-file=.env')
  process.exit(1)
}

const supabase = createClient(url, anon, { auth: { persistSession: false } })
const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
if (error || !data?.session) {
  console.error(`refresh failed: ${error?.message ?? 'no session returned'}`)
  console.error('The refresh token has expired too. Use: node --env-file=.env scripts/sign-in.js <email> <password>')
  process.exit(1)
}

writeFileSync(PATH, JSON.stringify(data.session, null, 2))
console.log(`session refreshed for ${data.session.user?.email}, expires ${new Date(data.session.expires_at * 1000).toISOString()}`)
