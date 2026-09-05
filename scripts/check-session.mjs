// ── THE SESSION IS VALID, ASKED BEFORE ANYTHING DEPENDS ON IT ────────────
//
// Migration Round 1, Phase 5. THREE TIMES IN TWO DAYS a gate run reported 14 or
// 15 of its stages FAILED, every HTTP stage, each in about 130ms against normal
// durations of 12,000 to 57,000ms. Nothing had run: the session token had
// expired and every probe got a 401 from its first call.
//
// WHY THAT IS WORTH A STAGE OF ITS OWN. The output does not read as an
// environment problem, it reads as FOURTEEN FINDINGS. Verification 48 exists
// because the first instinct is to open them, and it names the tell - a stage
// that fails faster than it could do its work has not run - but a rule that
// depends on somebody comparing durations is a rule that will be skipped by
// whoever is in a hurry.
//
// A pre-stage removes the judgement. On an expired session the gate stops here,
// says one thing, and the HTTP stages DO NOT RUN, so there is no list of
// failures to misread in the first place.
//
// IT VALIDATES BY USE, NOT BY ARITHMETIC. Reading `expires_at` and comparing it
// to the clock would answer a different question: a token can be revoked, the
// project's keys can rotate, and the file can be for a user who no longer has
// access. One authenticated round trip answers the question actually being
// asked, which is whether the probes' first call will work.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
// ── THROUGH THE PROBES' OWN TRANSPORT ────────────────────────────────────
//
// The first version called `fetch` directly and the pure suite refused it: no
// script calls fetch except the two allowed to, because a clock skew is a
// property of the CONNECTION and the retry lives on the transport
// (Verification 25's remedy).
//
// The guard was right for a second reason it does not know about. This stage's
// claim is "the probes' first call will work", and the only way to test that
// claim is to make the probes' first call, through the retry they get. A raw
// fetch would answer a question about a different client.
import { api, sessionUser } from './api-client.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const REF = join(ROOT, 'session-ref.json')
const FIX = 'node --env-file=.env scripts/refresh-session.js'

const die = (what) => {
  console.error('')
  console.error('  THE SESSION IS NOT USABLE. No HTTP stage has been run.')
  console.error('')
  console.error(`  ${what}`)
  console.error('')
  console.error('  This is an ENVIRONMENT condition, not a finding about the code.')
  console.error('  Refresh the session and run the gate again:')
  console.error('')
  console.error(`      ${FIX}`)
  console.error('')
  process.exit(1)
}

if (!existsSync(REF)) die('session-ref.json does not exist.')

let session
try {
  session = JSON.parse(readFileSync(REF, 'utf8'))
} catch (err) {
  die(`session-ref.json is not readable JSON: ${err.message}`)
}

const token = session?.access_token
if (typeof token !== 'string' || !token) die('session-ref.json carries no access_token.')

// ── AND IT EXTENDS THE SESSION RATHER THAN ONLY VALIDATING IT ────────────
//
// Round 2 Phase 0 item 3. The pre-stage validated once, at the start, and a
// gate can outlive its token: on 2026-09-05 this stage PASSED at 0s and the
// HTTP stages 401'd anyway, which is the exact failure the stage exists to
// prevent, arriving through a door it did not cover.
//
// MEASURED, both halves. A token is issued for 3600s. The last four gate runs
// took 356, 361, 365 and 375 seconds of stage time. So a gate cannot outlive a
// FRESH token; it only dies when the token was already near expiry at the
// start.
//
// THE POSITION, of the two the brief offered: EXTEND AT GATE START, not
// re-validate before the HTTP block. Re-validating only labels the failure -
// the pure and database suites have already run and the HTTP block still does
// not execute. Extending PREVENTS it, for about one second, and turns a
// 6-minute gate against a 60-minute token into a 10x margin.
//
// The threshold is 15 minutes: 2.5x the longest observed gate. Below it the
// token is refreshed; above it nothing is touched, so an ordinary run does not
// churn credentials.
const REFRESH_BELOW_SECONDS = 15 * 60
const expiresAt = Number(session.expires_at) || 0
const secondsLeft = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0
if (expiresAt && secondsLeft < REFRESH_BELOW_SECONDS) {
  console.log(`      session has ${Math.max(0, Math.round(secondsLeft / 60))} minutes left, under the ${REFRESH_BELOW_SECONDS / 60} minute floor. Extending.`)
  const r = spawnSync('node', ['--env-file=.env', 'scripts/refresh-session.js'],
    { cwd: ROOT, encoding: 'utf8' })
  // A failed refresh is NOT fatal here. The existing token may still have
  // minutes on it, and the validation below is the authority on whether the
  // probes' first call will work. What must not happen is this stage inventing
  // a diagnosis; refresh-session.js prints its own, honestly, since item 2.
  console.log((r.stdout ?? '').trim() || (r.stderr ?? '').trim().split('\n')[0] || '      refresh produced no output')
  if (r.status === 0) session = JSON.parse(readFileSync(REF, 'utf8'))
}

// ── AND IT MUST BE A ROUTE THAT ACTUALLY REQUIRES AUTH ─────────────────
//
// The first version asked for /api/config and PASSED against a deliberately
// corrupted token, because that route is unauthenticated. It would have
// reported a live session on every dead one - the precise failure this stage
// exists to prevent, inside the stage built to prevent it.
//
// Caught by calibrating rather than by reading, which is Verification 17: a
// probe can be well formed, run cleanly, and still be unable to tell the two
// states apart. /industries is the route the failing probes actually 401 on,
// so it is the one whose answer means something here.
try {
  await api('GET', '/industries')
} catch (err) {
  if (err?.status === 401 || err?.status === 403) {
    die(`The API answered ${err.status} to an authenticated request. The token is expired or revoked.`)
  }
  if (err?.status) die(`The API answered ${err.status} to GET /industries.`)
  console.error('')
  console.error('  THE DEV SERVER IS NOT ANSWERING ON :3000. No HTTP stage has been run.')
  console.error('')
  console.error(`  ${err?.message ?? err}`)
  console.error('')
  console.error('  Start it, then run the gate again:')
  console.error('')
  console.error('      node --env-file=.env src/server.js')
  console.error('')
  process.exit(1)
}

let who = 'unknown user'
try { who = sessionUser()?.email ?? who } catch { /* the identity is a nicety, not the claim */ }
console.log(`PASS  session is live for ${who}, and :3000 is answering`)
