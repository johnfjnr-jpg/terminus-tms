// Creates a confirmed test user in Supabase Auth via the admin API
// (service role key, bypasses RLS — see src/supabase.js usage log).
//
//   node --env-file=.env scripts/create-test-user.js <email>
//
// Password is read from a masked interactive prompt, never from argv or
// an env var, so it never ends up in shell history or process listings.

import { supabaseAdmin } from '../src/supabase.js'

const email = process.argv[2]

if (!email) {
  console.error('Usage: node --env-file=.env scripts/create-test-user.js <email>')
  process.exit(1)
}

const ENTER_CODES = [10, 13, 4] // \n, \r, Ctrl-D
const CTRL_C_CODE = 3
const BACKSPACE_CODE = 127

function promptHiddenPassword(query) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process
    stdout.write(query)
    stdin.resume()
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')

    let password = ''
    const onData = (char) => {
      const code = char.charCodeAt(0)
      if (ENTER_CODES.includes(code)) {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        resolve(password)
      } else if (code === CTRL_C_CODE) {
        stdout.write('\n')
        process.exit(1)
      } else if (code === BACKSPACE_CODE) {
        password = password.slice(0, -1)
      } else {
        password += char
      }
    }
    stdin.on('data', onData)
  })
}

const password = await promptHiddenPassword(`Password for ${email}: `)

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
