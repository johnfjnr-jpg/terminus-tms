// Signs in to Supabase Auth with a test user's email/password and prints
// the access token, for use in curl testing:
//
//   node --env-file=.env scripts/sign-in.js test@example.com password123
//   curl -X POST http://localhost:3000/api/deals/calculate \
//     -H "Authorization: Bearer $(node --env-file=.env scripts/sign-in.js test@example.com password123)" \
//     -H "Content-Type: application/json" \
//     -d '{...}'

import { createClient } from '@supabase/supabase-js'

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

console.log(data.session.access_token)
