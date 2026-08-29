// Creates a confirmed test user in Supabase Auth, or SETS THE PASSWORD on one
// that already exists, via the admin API (service role key, bypasses RLS - see
// src/supabase.js usage log).
//
//   node --env-file=.env scripts/create-test-user.js <email>
//
// Password is read from a masked interactive prompt, never from argv, so it
// never reaches shell history, `ps` output, scrollback or a session log. See
// scripts/lib/prompt-password.js for the full list of places it would land.
//
// ── WHY IT UPDATES AS WELL AS CREATES, Round 39, 2026-08-29 ────────────────
//
// It used to fail with "A user with this email address has already been
// registered" and leave you with the recovery-email path, which is rate limited
// and mails a link nobody wants. With the service role key already in hand,
// setting the password directly is one call and no email.
//
// It SAYS WHICH IT DID. A script that silently either creates or overwrites is
// a script you cannot tell has just reset a password you did not mean to touch.
//
// ── AND IT PROVES THE PASSWORD WORKS ───────────────────────────────────────
//
// The admin API reports success for the write, which is not the claim anybody
// cares about: the claim is that the new password authenticates. Verification 8
// in CLAUDE.md, a write whose result is not otherwise read looks like it
// worked. So the last step signs in with the anon key and the password just
// set, and a failure there is a non-zero exit, not a warning.
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../src/supabase.js'
// The masked prompt moved to scripts/lib/prompt-password.js in Round 39 so
// sign-in.js could use the same one. This file is where it came from.
import { promptHiddenPassword, refuseArgvPassword } from './lib/prompt-password.js'

const USAGE = 'node --env-file=.env scripts/create-test-user.js <email>'
const email = process.argv[2]

if (!email) {
  console.error(`Usage: ${USAGE}`)
  process.exit(1)
}

refuseArgvPassword(process.argv.slice(2), USAGE)

// ── EVERY PAGE, NOT THE FIRST ONE ──────────────────────────────────────────
//
// listUsers defaults to 50 per page. A scan that reads one page and reports
// "no such user" is Verification 17's paged-API species: the probe
// discriminates perfectly and is shown only part of the population, so a user
// on page 2 reads exactly like a user who does not exist, and the script then
// CREATES a duplicate rather than updating.
//
// The client's own `nextPage` is not trusted for this. Its link-header parser
// takes `.substring(0, 1)` of the page number, so page 10 onward parses as 1.
// Paging until a short page is returned does not depend on that.
async function findUserByEmail(target) {
  const wanted = target.trim().toLowerCase()
  const perPage = 200
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error(`Failed to list users: ${error.message}`)
      process.exit(1)
    }
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').trim().toLowerCase() === wanted)
    if (hit) return hit
    if (users.length < perPage) return null
  }
}

let password
try {
  password = await promptHiddenPassword(`Password for ${email}: `)
} catch (e) {
  // A stack trace is not failing loudly, it is failing illegibly.
  console.error(e.message)
  process.exit(1)
}

if (password.length < 6) {
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}

const existing = await findUserByEmail(email)

let action
let user
if (existing) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
  if (error) {
    console.error(`Failed to set password: ${error.message}`)
    process.exit(1)
  }
  action = 'Updated password for'
  user = data.user
} else {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.error(`Failed to create user: ${error.message}`)
    process.exit(1)
  }
  action = 'Created'
  user = data.user
}

console.log(`${action} ${user.email} (id: ${user.id})`)

// The verification, and it is the point of the change rather than a flourish.
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
})
const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password })

if (signInError || !signIn?.session) {
  console.error(`VERIFY FAILED: the new password does not authenticate (${signInError?.message ?? 'no session returned'}).`)
  process.exit(1)
}

console.log(`Verified: the password authenticates as ${signIn.user.email}.`)
