// Signs in to Supabase Auth, WRITES THE FULL SESSION to session-ref.json, and
// prints the access token.
//
//   node --env-file=.env scripts/sign-in.js <email>
//
// The password comes from a MASKED PROMPT, never from argv. For unattended runs
// set TMS_TEST_PASSWORD, and only for a scratch project's throwaway account.
// Both paths live in scripts/lib/prompt-password.js, which explains why they
// are two paths rather than one with a fallback.
//
// ── WHY IT NO LONGER TAKES A PASSWORD ARGUMENT, Round 39, 2026-08-29 ───────
//
// It did, and this file was the outlier: create-test-user.js has read from a
// masked prompt since it was written, so the repository already had the
// convention and one script ignored it. The cost was that the merge gate's
// documented recovery step put a real password into ~/.zsh_history in
// plaintext, three times in one round, where it is backed up and synced.
//
// Passing one now REFUSES rather than works, because by then the exposure has
// already happened and the only useful act is to say so and name rotation.
//
// ── WHY IT WRITES, Round 39 ───────────────────────────────────────────────
//
// It used to only print. refresh-session.js reads session-ref.json, and when
// the refresh token has expired it names this script as the recovery step.
// THAT INSTRUCTION COULD NOT RESTORE THE THING IT NAMED: session-ref.json was
// written by exactly one file, refresh-session.js, which needs a live refresh
// token, which is the one thing that has just been established as dead. Running
// this printed a token to a terminal and left every probe reading the expired
// file.
//
// Found the first time the path was actually needed, which is when a recovery
// path is always found. CLAUDE.md Verification 25's corollary: a recovery path
// that has never been exercised is not a recovery path, it is a plan.
//
// session-ref.json is gitignored (.gitignore:7) and no-secrets.test.mjs fails
// the suite if anything credential-shaped reaches a tracked file, so writing
// the refresh token here is safe by two independent guards rather than one.
//
// The access token still goes to stdout ALONE, so the curl pipeline this was
// written for is unchanged:
//   -H "Authorization: Bearer $(node --env-file=.env scripts/sign-in.js you@x)"
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { readPassword, refuseArgvPassword } from './lib/prompt-password.js'

const USAGE = 'node --env-file=.env scripts/sign-in.js <email>'
const args = process.argv.slice(2)
// Flags are not a password. refuseArgvPassword counts POSITIONAL arguments only.
const positional = args.filter((a) => !a.startsWith('--'))
const [email] = positional

if (!email) {
  console.error(`Usage: ${USAGE}`)
  process.exit(1)
}

refuseArgvPassword(positional, USAGE)

let password
try {
  password = await readPassword(`Password for ${email}: `)
} catch (e) {
  // A stack trace is not failing loudly, it is failing illegibly.
  console.error(e.message)
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

// ── THE TOKEN ONLY WHERE SOMETHING CONSUMES IT ────────────────────────────
//
// Round 39, and the same two-paths distinction as the password. The token on
// stdout exists for the curl pipeline; a person running this interactively has
// no use for it, and printing it puts a live credential in scrollback where it
// gets pasted into a chat window without thinking. That happened.
//
// So: piped or redirected, print it, because something is reading it. A
// terminal, say where the session went and nothing else. --print-token forces
// it for the case where somebody genuinely wants it on screen.
const wantsToken = args.includes('--print-token') || !process.stdout.isTTY
if (wantsToken) {
  console.log(data.session.access_token)
} else {
  console.error('Access token not printed. It is in session-ref.json, and every '
    + 'probe reads it from there. Pipe this command or pass --print-token if you need it.')
}
