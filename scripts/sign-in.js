// Signs in to Supabase Auth with a test user's email/password, WRITES THE FULL
// SESSION to session-ref.json, and prints the access token.
//
//   node --env-file=.env scripts/sign-in.js test@example.com password123
//
// ── WHY IT WRITES, added Round 39, 2026-08-29 ──────────────────────────────
//
// It used to only print. refresh-session.js reads session-ref.json, and when the
// refresh token has expired it prints "Use: scripts/sign-in.js <email>
// <password>" as the recovery step. THAT INSTRUCTION COULD NOT RESTORE THE
// THING IT NAMED: session-ref.json was written by exactly one file,
// refresh-session.js, which needs a live refresh token, which is the one thing
// that has just been established as dead. Running sign-in.js printed a token to
// a terminal and left every probe still reading the expired file.
//
// Found the first time the path was actually needed, which is when a recovery
// path is always found. The rotation after the committed credential invalidated
// the refresh token deliberately and correctly, and that was the first exercise
// of this branch. Architecture rule 8: correct for every caller that exists is
// not correct for the caller about to be built.
//
// session-ref.json is gitignored (.gitignore:7) and no-secrets.test.mjs fails
// the suite if anything credential-shaped reaches a tracked file, so writing
// the refresh token here is safe by two independent guards, not by one.
//
// The access token still goes to stdout alone, so the curl pipeline this was
// written for is unchanged:
//   -H "Authorization: Bearer $(node --env-file=.env scripts/sign-in.js ...)"
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const [email, password] = process.argv.slice(2)

if (!email || !password) {
  console.error('Usage: node --env-file=.env scripts/sign-in.js <email> <password>')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY)

const { data, error } = await supabase.auth.signInWithPassword({ email, password })

if (error) {
  console.error(error.message)
  process.exit(1)
}

const PATH = new URL('../session-ref.json', import.meta.url).pathname
writeFileSync(PATH, JSON.stringify(data.session, null, 2))
console.error(`session-ref.json written for ${data.session.user?.email}, expires `
  + `${new Date(data.session.expires_at * 1000).toISOString()}`)

console.log(data.session.access_token)
