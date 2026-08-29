// Creates a confirmed test user in Supabase Auth via the admin API
// (service role key, bypasses RLS — see src/supabase.js usage log).
//
//   node --env-file=.env scripts/create-test-user.js <email>
//
// Password is read from a masked interactive prompt, never from argv or
// an env var, so it never ends up in shell history or process listings.

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

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true
})

if (error) {
  console.error(`Failed to create user: ${error.message}`)
  process.exit(1)
}

console.log(`Created user ${data.user.email} (id: ${data.user.id})`)
