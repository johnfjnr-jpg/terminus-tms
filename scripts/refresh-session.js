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
  // ── THE CAUGHT ERROR FIRST, AND THE DIAGNOSIS ONLY WHERE IT FITS ───────
  //
  // Round 2 Phase 0 item 2. This printed "The refresh token has expired too"
  // on EVERY failure, unconditionally. On 2026-09-05 the real cause was
  // `fetch failed` - a stuck VPN DNS entry - and the hardcoded sentence sent
  // two separate diagnoses toward a password nobody in the session had, while
  // the actual cause sat one line above and was discarded by a `tail -2`.
  //
  // Architecture 9's fourth variant: a literal that cannot be falsified, and
  // this one was load-bearing because people ACT on it.
  //
  // The error is printed first and in full. The remedy is chosen from what the
  // error says, and where it says nothing recognisable, the script says so
  // rather than guessing.
  const msg = error?.message ?? 'no session returned'
  console.error(`refresh failed: ${msg}`)
  if (error?.status) console.error(`status: ${error.status}`)

  const networkish = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ConnectTimeout|socket hang up|network/i.test(msg)
  const expiredish = /refresh[_ ]token|invalid|expired|already used|not found/i.test(msg) || error?.status === 400

  console.error('')
  if (networkish) {
    console.error('That is a CONNECTIVITY failure, not an expired token. Nothing is wrong with the session.')
    console.error('Check, as separate steps, DNS resolution and TCP connect to the Supabase host,')
    console.error('and whether a VPN is active: a VPN resolver with a stuck entry looks exactly like')
    console.error('the service being down until the two are measured apart.')
    console.error('')
    console.error('    node scripts/check-reachable.mjs')
  } else if (expiredish) {
    console.error('The refresh token itself is no longer valid. Sign in again:')
    console.error('')
    console.error('    node --env-file=.env scripts/sign-in.js <email> <password>')
    console.error('')
    console.error('That command rewrites session-ref.json, so the probes and the gate recover from it directly.')
  } else {
    console.error('The cause above is not one this script recognises, so it is NOT guessing at a remedy.')
    console.error('Read the message, then choose between a connectivity check and a fresh sign-in:')
    console.error('')
    console.error('    node scripts/check-reachable.mjs')
    console.error('    node --env-file=.env scripts/sign-in.js <email> <password>')
  }
  process.exit(1)
}

writeFileSync(PATH, JSON.stringify(data.session, null, 2))
console.log(`session refreshed for ${data.session.user?.email}, expires ${new Date(data.session.expires_at * 1000).toISOString()}`)
