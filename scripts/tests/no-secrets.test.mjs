// No tracked file carries a token-shaped string. Round 39.
// Runs under `npm test`, so CI enforces it on every push.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS EXISTS, AND WHY THE IGNORE RULE WAS NOT THE FIX
// ─────────────────────────────────────────────────────────────
//
// Round 39 committed frontend/.dev-session.json, carrying an access token and a
// refresh token, through an ordinary `git add -A`. Three things were needed and
// only one of them is history rewriting:
//
//   ROTATE. Done, and proven: the refresh token now answers "Refresh Token Not
//   Found" and the access token answers 403. Expiry is not invalidation.
//
//   GET IT OUT OF THE TREE. Done. The dev session is served from outside the
//   repository through TMS_DEV_SESSION_DIR, which the server refuses to point
//   inside the repo. No ignore rule is load-bearing because there is nothing in
//   the tree to ignore.
//
//   MAKE THE NEXT ONE IMPOSSIBLE. This file. It will not be that file next time,
//   so the check is on the SHAPE of a secret rather than on a filename.
//
// The deeper fault was never the missing ignore rule. It was that the file was
// ever somewhere an ignore rule was the last thing standing between it and a
// commit.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

// Shapes, not names. Each is a thing that is a secret whatever it is called.
const SECRET_SHAPES = [
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase publishable key', re: /\bsb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase access token', re: /\bsbp_[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'refresh_token field with a value', re: /"refresh_token"\s*:\s*"[A-Za-z0-9._-]{12,}"/ },
]

// Binary and generated files a text scan cannot read usefully. Named, not
// pattern-matched, so adding one is a decision.
const SKIP_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf']

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter(Boolean)
}

export function scanText(text) {
  return SECRET_SHAPES.filter((s) => s.re.test(text)).map((s) => s.name)
}

test('no tracked file carries a token-shaped string', () => {
  const findings = []
  for (const file of trackedFiles()) {
    if (SKIP_EXT.some((e) => file.toLowerCase().endsWith(e))) continue
    const full = join(ROOT, file)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.size > 4_000_000) continue
    const hits = scanText(readFileSync(full, 'utf8'))
    if (hits.length) findings.push(`${file}: ${hits.join(', ')}`)
  }
  assert.deepEqual(findings, [],
    'these tracked files carry something shaped like a credential:\n  ' + findings.join('\n  ')
    + '\nRotate it first, then remove it from the tree, then rewrite the history that carries it.')
})

test('the scan can SEE each shape it claims to look for', () => {
  // Verification 25: a zero from an instrument never shown reaching one is not a
  // measurement. Every pattern is exercised, not just the list's existence.
  //
  // ASSEMBLED FROM PARTS so this file does not fail its own scan, the same way
  // the fetch scan's calibration string is assembled.
  const J = 'ey' + 'J' + 'hbGciOiJIUzI1NiJ9.' + 'eyJzdWIiOiIxMjM0NSJ9.' + 'QWJjRGVmR2hpSktMbW5v'
  const cases = [
    ['JWT', J],
    ['Supabase secret key', 'sb' + '_secret_' + 'AbCdEfGhIjKlMnOpQr'],
    ['Supabase publishable key', 'sb' + '_publishable_' + 'AbCdEfGhIjKlMnOpQr'],
    ['Supabase access token', 'sb' + 'p_' + 'abcdefghijklmnopqrstuvwxyz01'],
    ['AWS access key id', 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP'],
    ['private key block', '-----BE' + 'GIN RSA PRIVATE KEY-----'],
    ['refresh_token field with a value', '{"refresh' + '_token": "abcdefghijklmnop"}'],
  ]
  for (const [name, sample] of cases) {
    assert.ok(scanText(sample).includes(name), `the ${name} pattern did not match its own sample`)
  }
})

test('and it does NOT fire on ordinary source', () => {
  // The discriminating half. A scan that flagged everything would pass the test
  // above and be switched off within a round.
  for (const benign of [
    'const token = process.env.SUPABASE_SECRET_KEY',
    'refresh_token: session.refresh_token',
    '"refresh_token": ""',
    'Authorization: `Bearer ${currentSession.access_token}`',
    'https://anvildouaacbhsjytkii.supabase.co',
  ]) {
    assert.deepEqual(scanText(benign), [], `false positive on: ${benign}`)
  }
})
