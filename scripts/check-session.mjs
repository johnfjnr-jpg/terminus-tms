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
