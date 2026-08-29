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

  { name: 'password/secret assignment carrying a value', fn: hasSecretAssignment },
]

// ── A PASSWORD IS NOT TOKEN-SHAPED ──────────────────────────────────────
//
// Added Round 39, 2026-08-29, by the business, BEFORE the requirement that
// needs it was built. The seven shapes above were all derived from the file
// that caused the incident, so every one of them describes a machine-issued
// credential with a recognisable prefix or structure.
//
// The merge-gate fix specifies TMS_TEST_PASSWORD in the environment, and a
// password chosen by a person HAS NO SHAPE AT ALL. Measured before this
// existed: `TMS_TEST_PASSWORD=` followed by a real password passed the scan
// cleanly. That is the same one-step-behind pattern that produced the incident,
// a guard built for the last credential rather than the next one.
//
// So this matches the ASSIGNMENT, because the name is the only signal available
// when the value is arbitrary text. It is a function rather than a regex
// because the exclusions are what decide whether it survives: a rule that fires
// on .env.example, on `const password = await prompt(...)`, or on the prose
// "two repository secrets: SUPABASE_URL" gets switched off within a round, and
// all three of those were real hits on the first version of it.
//
// TWO ACCEPTED FORMS, and nothing else:
//   env-file      SCREAMING_SNAKE=value    no spaces, that is what .env holds
//   code literal  password: 'value'        a quoted string, that is what code holds
const ASSIGNMENT = /(?:^|[^A-Za-z0-9_])([A-Za-z0-9_.]*(?:password|passwd|secret|apikey|api_key|pwd)[A-Za-z0-9_]*)["'`]?\s*[:=]+\s*(.+)$/i
const ENV_REFERENCE = /^(?:process\.env|Deno\.env|import\.meta\.env|os\.environ|System\.getenv|await|require)\b/
const SCREAMING = /^[A-Z][A-Z0-9_]*$/

export function hasSecretAssignment(text) {
  for (const line of text.split('\n')) {
    const m = ASSIGNMENT.exec(line)
    if (!m) continue
    const name = m[1]
    let value = m[2].trim()

    // A quoted literal is the code form. Anything else must be an env-file
    // line, which means an upper-case name and a value with no spaces in it.
    const quote = /^['"`]/.test(value) ? value[0] : null
    if (quote) {
      const close = value.indexOf(quote, 1)
      if (close === -1) continue
      value = value.slice(1, close)
    } else {
      if (/\s/.test(value)) continue
      if (!SCREAMING.test(name.replace(/^.*\./, ''))) continue
      value = value.replace(/[,;]+$/, '')
    }

    if (value.length < 8) continue
    if (/^[$<{%]/.test(value)) continue          // expansion or placeholder
    if (value.includes('...')) continue          // documentation elision
    if (ENV_REFERENCE.test(value)) continue      // a reference, not a value
    if (SCREAMING.test(value)) continue          // an env var NAME, not its value
    return true
  }
  return false
}

// Binary and generated files a text scan cannot read usefully. Named, not
// pattern-matched, so adding one is a decision.
const SKIP_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf']

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter(Boolean)
}

export function scanText(text) {
  return SECRET_SHAPES.filter((s) => (s.fn ? s.fn(text) : s.re.test(text))).map((s) => s.name)
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
    // The shape the merge-gate fix introduces. Assembled the same way, and the
    // sample is deliberately an ordinary human password with no structure at
    // all, because that is exactly what the seven shapes above cannot see.
    ['password/secret assignment carrying a value', 'TMS_TEST_PASS' + 'WORD=' + 'correct-horse-battery'],
    ['password/secret assignment carrying a value', 'export APP_SEC' + 'RET=' + 'Tr0ub4dor&3xyz'],
    ['password/secret assignment carrying a value', '{"pass' + 'word": "' + 'letmein12345"}'],
    ['password/secret assignment carrying a value', "const pass" + "word = '" + "hunter2hunter2'"],
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
    // The assignment rule's own false-positive surface. .env.example is tracked
    // and is nothing but these three forms, so a rule that fires on them would
    // be switched off within a round.
    'const key = process.env.SUPABASE_SECRET_KEY',
    'SUPABASE_SECRET_KEY=',
    'SUPABASE_SECRET_KEY=eyJ...',
    'TMS_TEST_PASSWORD=<your-password>',
    'TMS_TEST_PASSWORD=$TMS_TEST_PASSWORD',
    'password: ${process.env.TMS_TEST_PASSWORD}',
    'SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}',
    'Usage: node scripts/sign-in.js <email> <password>',
    // Every one of these was a real hit on the first version of the rule.
    'const password = await promptHiddenPassword(`Password for ${email}: `)',
    '2. Two repository secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a test',
    "let password = ''",
    'password = password.slice(0, -1)',
    'TMS_TEST_PASSWORD=$TMS_TEST_PASSWORD',
  ]) {
    assert.deepEqual(scanText(benign), [], `false positive on: ${benign}`)
  }
})
