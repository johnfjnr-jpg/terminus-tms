import { createClient } from '@supabase/supabase-js'

// Per-request user-scoped client — RLS applies as the authenticated user.
// Every API route that touches the database calls this.
export function createUserClient(jwt) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false }
    }
  )
}

// ── SERVICE ROLE USAGE LOG ────────────────────────────────────────────────────
// supabaseAdmin bypasses RLS entirely. Before using it in an API route, add
// an entry here explaining why the user-scoped client is insufficient.
//
// M1 API route uses: NONE
//   All API operations run under the user's JWT via createUserClient().
//
// Legitimate out-of-band uses (not API routes):
//   supabase/migrations/ and supabase/seeds/ — applied via CLI or dashboard
//   as the database superuser; supabaseAdmin is not involved.
//
// ─────────────────────────────────────────────────────────────────────────────
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)
