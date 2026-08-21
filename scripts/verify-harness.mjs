// Round 7 Phase 1, section 1.0 - shared fixtures and teardown for the
// database-backed suite (`npm run test:db`).
//
// This module reaches a real database. It must NEVER be imported by
// scripts/tests/cost.test.mjs, which `npm test` runs on a clean checkout
// with no credentials. Keeping that path import-free is what lets the
// GitHub Action run on every push without CI secrets.
//
// Credentials and paths come from the environment, never from a
// hardcoded absolute path. Reads process.env first so CI or a shell
// export wins; falls back to the local .env for developer convenience.
//
// Fixture discipline follows DESIGN_PRINCIPLES.md Rule 9:
//   - every fixture is disposable and tagged with a per-run runTag, so a
//     run never reuses a real, already-existing record as a convenient
//     test subject;
//   - every delete checks its returned error AND its affected-row count;
//   - nothing is reported as torn down without re-querying to confirm
//     the row is actually gone.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..')

export function loadEnv() {
  const env = { ...process.env }
  const dotenv = join(REPO_ROOT, '.env')
  if (existsSync(dotenv)) {
    for (const line of readFileSync(dotenv, 'utf8').split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      if (env[key] === undefined) env[key] = line.slice(i + 1).trim()
    }
  }
  const missing = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'].filter(k => !env[k])
  if (missing.length) {
    throw new Error(
      `verify-harness: missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Set them in the environment or in ${dotenv}. ` +
      `These tests require a real database; run \`npm test\` for the pure suite instead.`
    )
  }
  return env
}

export function adminClient(env = loadEnv()) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// A per-run tag. Every fixture name, record_type and counter key derives
// from this, so two runs (or a run racing a human in the real UI) can
// never collide.
export function newRunTag() {
  return `r7h${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
}

/**
 * Resolves a real auth user to own fixture records. records.owner_id is
 * a NOT NULL foreign key to auth.users, so fixtures cannot be created
 * without one. Uses an existing user rather than creating one - creating
 * auth users as a test side effect is a bigger footprint than this suite
 * needs, and users are not cleaned up by teardown.
 */
export async function resolveOwnerId(db) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw new Error(`verify-harness: could not list auth users: ${error.message}`)
  const user = data?.users?.[0]
  if (!user) throw new Error('verify-harness: no auth user exists to own fixture records')
  return user.id
}

/**
 * Tracks everything a run creates and tears it down in reverse dependency
 * order. Business records are SOFT deleted (records carries FK references
 * from record_revisions/approvals/audit_log with ON DELETE RESTRICT, so a
 * hard delete would be blocked - which is exactly the Rule 9 incident that
 * produced an orphaned, revision-less Account). Config and junction rows
 * created by the run are hard deleted, each one verified.
 */
export class Fixtures {
  constructor(db, runTag) {
    this.db = db
    this.runTag = runTag
    this.records = []
    this.rules = []
    this.approvals = []
    this.contactLinks = []
    // Deliberately absent: reference_number_counters. See teardown().
  }

  // document_kind added Round 11 Phase 6. This signature DESTRUCTURES a fixed
  // key set, so anything a caller passes that is not named here is silently
  // dropped - which is what happened first: the three document fixtures were
  // given a kind, the harness discarded it, and the CHECK constraint rejected
  // them exactly as before. A fixed destructure is a quiet allowlist.
  async createRecord({ record_type, status, variant = null, parent_record_id = null, owner_id, document_kind = null }) {
    const { data, error } = await this.db.from('records')
      .insert({ record_type, status, variant, parent_record_id, owner_id, document_kind })
      .select('id, record_type, variant, status, parent_record_id')
      .single()
    if (error) throw new Error(`fixture createRecord failed: ${error.message}`)
    this.records.push(data.id)
    return data
  }

  async createRule({ record_type, variant = null, from_stage, to_stage, requirement_type, requirement_detail }) {
    const { data, error } = await this.db.from('stage_gate_rules')
      .insert({ record_type, variant, from_stage, to_stage, requirement_type, requirement_detail })
      .select('id').single()
    if (error) throw new Error(`fixture createRule failed: ${error.message}`)
    this.rules.push(data.id)
    return data
  }

  async createApproval({ record_id, revision_number, track, decision, approver_id, stage = null }) {
    const { data, error } = await this.db.from('approvals')
      .insert({ record_id, revision_number, track, decision, approver_id, stage })
      .select('id').single()
    if (error) throw new Error(`fixture createApproval failed: ${error.message}`)
    this.approvals.push(data.id)
    return data
  }

  async createContactLink({ record_id, contact_id, role, created_by }) {
    const { data, error } = await this.db.from('record_contacts')
      .insert({ record_id, contact_id, role, created_by })
      .select('id').single()
    if (error) throw new Error(`fixture createContactLink failed: ${error.message}`)
    this.contactLinks.push(data.id)
    return data
  }

  // Hard delete with both checks Rule 9 requires: the returned error, and
  // the affected-row count. Returns nothing useful on purpose - callers
  // must not treat "no error" as proof; teardown() re-queries afterwards.
  async #hardDelete(table, ids, problems) {
    for (const id of ids) {
      const { data, error } = await this.db.from(table).delete().eq('id', id).select('id')
      if (error) { problems.push(`${table} ${id}: delete errored: ${error.message}`); continue }
      if (!data || data.length !== 1) {
        problems.push(`${table} ${id}: delete affected ${data?.length ?? 0} rows, expected 1`)
      }
    }
  }

  /**
   * Tears down everything this run created, then PROVES it by re-querying
   * each table. Throws loudly on any failure rather than printing a
   * fixture id as "torn down" without confirming it.
   *
   * reference_number_counters rows are NEVER deleted here. That is not a
   * style choice: deleting a counter while a soft-deleted record still
   * permanently holds a code from it caused a real unique-constraint
   * collision in Milestone 4 (DESIGN_PRINCIPLES.md, Deferred scope).
   * Reference codes are never reused, so a restarted counter collides
   * with an already-claimed code. Counter rows created by a run are left
   * in place; the per-run unique key is what keeps them clear of real
   * counters.
   */
  async teardown() {
    const problems = []

    await this.#hardDelete('record_contacts', this.contactLinks, problems)
    await this.#hardDelete('approvals', this.approvals, problems)
    await this.#hardDelete('stage_gate_rules', this.rules, problems)

    // Business records: soft delete, and check the affected-row count,
    // since an .update() that matches nothing returns no error at all.
    for (const id of this.records) {
      const { data, error } = await this.db.from('records')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id')
      if (error) { problems.push(`records ${id}: soft delete errored: ${error.message}`); continue }
      if (!data || data.length !== 1) {
        problems.push(`records ${id}: soft delete affected ${data?.length ?? 0} rows, expected 1`)
      }
    }

    // Rule 9: query the actual state back. Do not infer it from the
    // delete results above.
    const verify = async (table, ids, expectGone) => {
      if (!ids.length) return
      const { data, error } = await this.db.from(table).select('id').in('id', ids)
      if (error) { problems.push(`${table}: verification query failed: ${error.message}`); return }
      const found = (data ?? []).map(r => r.id)
      if (expectGone && found.length) problems.push(`${table}: still present after delete: ${found.join(', ')}`)
    }
    await verify('record_contacts', this.contactLinks, true)
    await verify('approvals', this.approvals, true)
    await verify('stage_gate_rules', this.rules, true)

    if (this.records.length) {
      const { data, error } = await this.db.from('records')
        .select('id, deleted_at').in('id', this.records)
      if (error) problems.push(`records: verification query failed: ${error.message}`)
      else {
        for (const r of data ?? []) {
          if (!r.deleted_at) problems.push(`records ${r.id}: deleted_at is still null after teardown`)
        }
      }
    }

    if (problems.length) {
      throw new Error(`TEARDOWN FAILED (${problems.length} problem(s)):\n  - ${problems.join('\n  - ')}`)
    }
    return {
      runTag: this.runTag,
      recordsSoftDeleted: this.records.length,
      rulesDeleted: this.rules.length,
      approvalsDeleted: this.approvals.length,
      contactLinksDeleted: this.contactLinks.length,
      counterRowsDeleted: 0, // always zero, by design - see the doc comment
    }
  }
}

// ---------------------------------------------------------------------------
// Round 18A Phase 3 - acting AS a user rather than as the service key.
//
// Every helper above this line uses adminClient(), which holds the service
// key and BYPASSES row-level security entirely. That is what fifty green
// runs across two rounds were measuring: a client for which no ownership
// policy is ever consulted. A suite built only on it cannot see an
// ownership rule at all, correct or broken, because it never meets one.
// ---------------------------------------------------------------------------

/**
 * A named probe user, created on first use and reused forever after.
 *
 * Deliberately NOT created per run. records.owner_id is a foreign key to
 * auth.users and fixture records are SOFT deleted (Verification 11), so a
 * user created per run still owns rows afterwards and can never be
 * removed. Per-run users would therefore accumulate permanently, one pair
 * per suite run, which is precisely the residue this project keeps finding.
 * Two fixed users cost two rows, once.
 */
export async function ensureProbeUser(db, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`ensureProbeUser: listUsers failed: ${error.message}`)
    const found = data?.users?.find(u => u.email === email)
    if (found) return found.id
    if (!data?.users?.length || data.users.length < 200) break
  }
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw new Error(`ensureProbeUser: createUser ${email} failed: ${error.message}`)
  return data.user.id
}

/**
 * A Supabase client authenticated AS the given user, so row-level security
 * applies to everything it does.
 *
 * Mints a real session the way a real sign-in does: generateLink produces a
 * magic-link token (it returns the link to this caller and dispatches no
 * mail), and verifyOtp exchanges it for a session on an anon-key client.
 * Measured Round 18A Phase 3: 30 consecutive generateLink calls and 12
 * consecutive full pairs, zero failures, roughly 190ms per session, so the
 * two sessions a suite run needs are nowhere near any budget.
 */
export async function userClient(email, env = loadEnv()) {
  // loadEnv only requires the service key, because everything else in this
  // module uses it. Acting as a user needs the anon key too, so it is
  // checked here rather than widened into loadEnv, which would break the
  // service-key-only callers that have never needed it.
  if (!env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('userClient: SUPABASE_PUBLISHABLE_KEY is not set. ' +
      'Acting as a user requires the anon key; the service key bypasses row-level security.')
  }
  const admin = adminClient(env)
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: link, error: linkErr } =
    await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr) throw new Error(`userClient: generateLink for ${email} failed: ${linkErr.message}`)
  const { data: session, error: otpErr } =
    await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
  if (otpErr) throw new Error(`userClient: verifyOtp for ${email} failed: ${otpErr.message}`)
  return { db: anon, userId: session.user.id, accessToken: session.session.access_token }
}
