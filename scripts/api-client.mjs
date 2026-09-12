// One HTTP client for every script in this repository, and it THROWS.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS EXISTS: AN UNCHECKED RESPONSE IS AN ASSUMED SUCCESS
// ─────────────────────────────────────────────────────────────
//
// Twice in Round 38, and by CLAUDE.md Verification 19 twice is a class rather
// than two mistakes:
//
//   A fixture script issued three PATCHes and read none of the responses. All
//   three were refused 400. The approval page then rendered an unpriced deal -
//   correctly - and it looked like a page defect for a minute, because the only
//   evidence available said the data was there.
//
//   PATCH /accounts/:id answered 500 to every call for a commit. The source scan
//   that exists to police those call sites passed it cleanly, because the call
//   had its six arguments and the identifier they named had never been imported.
//   Only a probe that read the response could see it.
//
// The fix is not to remember. `fetch` returns a resolved promise for a 500 the
// same as for a 200, so checking is an extra step that has to be taken every
// time, and the failure of that step is invisible. Here the extra step is
// NOT checking: a non-2xx throws unless the call says, in words, why it expects
// one.
//
// ─────────────────────────────────────────────────────────────
// OPTING OUT IS A SENTENCE, NOT A FLAG
// ─────────────────────────────────────────────────────────────
//
// Probes deliberately assert refusals: a stale revision must answer 409, a
// string revision must answer 400. Those are the point of the probe, not
// accidents. So `expect` takes the status and `because` takes the reason, and
// both are required together:
//
//   await api('POST', '/x', body, { expect: 409, because: 'the record moved' })
//
// A bare `expect` with no reason throws too. The reason is what makes an opt-out
// reviewable later, and a boolean flag would have been quietly copy-pasted onto
// calls that never thought about it.

import { readFileSync } from 'node:fs'

// ── RESOLVED FROM THIS MODULE, NOT FROM ONE MACHINE ─────────────────────────
//
// This was the absolute path of one laptop, and every checkout that was not that
// laptop failed on it. CI has been red since Round 38 for exactly this, four
// tests deep in a suite that reports green locally, and nobody looked because
// the local gate said 222/222.
//
// AND IT IS READ LAZILY. At module load it threw ENOENT before any test could
// run, so tests that never make a request were failing on a file they do not
// need. A clean checkout HAS no session-ref.json: it is gitignored, because it
// holds a credential.
const SESSION_PATH = new URL('../session-ref.json', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} -> ${status} ${JSON.stringify(body)}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function token() {
  // TMS_ACCESS_TOKEN first, for two callers that have no session file: the PURE
  // SUITE, which stubs fetch and never leaves the process, and an unattended CI
  // run against the scratch project once that exists. Same two-paths shape as
  // the password in scripts/lib/prompt-password.js.
  //
  // Without this the pure suite needed a signed-in session on disk to test its
  // own error handling, which is what made four of its tests fail on every
  // machine that was not the one laptop.
  if (process.env.TMS_ACCESS_TOKEN) return process.env.TMS_ACCESS_TOKEN

  // Read at CALL time, not at import time. A caller that never makes a request
  // must not need a signed-in session to exist.
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf8')).access_token
  } catch (e) {
    throw new Error(
      `No session at ${SESSION_PATH}. Run: node --env-file=.env scripts/sign-in.js <email>\n  (${e.code ?? e.message})`)
  }
}

/**
 * @param {string} method
 * @param {string} path - under /api
 * @param {object} [body]
 * @param {{ expect?: number, because?: string }} [opts]
 *   expect: the non-2xx status this call is asserting.
 *   because: why. Required whenever expect is given.
 * @returns {Promise<{ status: number, ok: boolean, data: any }>}
 * @throws {ApiError} on any status the call did not say it expected
 */
export async function api(method, path, body, opts = {}) {
  const { expect, because } = opts
  if (expect !== undefined && !because) {
    throw new Error(
      `api(${method} ${path}): expect: ${expect} needs because: '<why>'. `
      + 'An opt-out without a stated reason is the unchecked response wearing a flag.')
  }
  if (expect === undefined && because) {
    throw new Error(`api(${method} ${path}): because: '${because}' given with no expect. Say which status.`)
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  const result = { status: res.status, ok: res.ok, data }

  if (expect !== undefined) {
    if (res.status !== expect) {
      throw new ApiError(method, path, res.status,
        { expected: expect, because, got: data })
    }
    return result
  }
  if (!res.ok) throw new ApiError(method, path, res.status, data)
  return result
}

/** The signed-in account, for scripts that need to know whose records they own. */
export function sessionUser() {
  return JSON.parse(readFileSync(SESSION_PATH, 'utf8')).user ?? null
}

// ── CALLING A POSTGREST RPC AS A NAMED IDENTITY ──────────────────────────
//
// Added for the LEADS CARD round's Phase 1b, and added HERE rather than
// exempting a probe, because the fetch guard caught that probe and was right
// to: a raw fetch bypasses the throwing client and a non-2xx goes silent.
//
// `api` above cannot serve this need for two reasons, both structural rather
// than stylistic:
//
//   IT READS ONE SESSION FILE. An identity counterfactual needs a SECOND, real
//   user's JWT, and "never the service role" is the standing rule - a declared
//   policy is not an enforcement, and a probe through the service role proves
//   nothing.
//
//   IT PREFIXES /api. A SECURITY INVOKER function is reached at PostgREST's
//   own /rest/v1/rpc, not through the Fastify routes.
//
// A refusal is DATA here, not an error: the whole point is to assert that a
// non-owner is refused ownership-shaped. So this returns the status rather
// than throwing, and the guard's concern is answered by the caller asserting
// it - which is what `expect` makes explicit below.
export async function rpcAs(session, fn, args, opts = {}) {
  const { expect, because } = opts
  if (expect !== undefined && !because) {
    throw new Error(`rpcAs(${fn}): expect: ${expect} needs because: '<why>'.`)
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('rpcAs needs SUPABASE_URL and an anon/publishable key')
  if (!session?.access_token) throw new Error('rpcAs needs a session with an access_token')

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args ?? {}),
  })
  const data = await res.json().catch(() => null)
  const result = { status: res.status, ok: res.ok, data }
  if (expect !== undefined && res.status !== expect) {
    throw new ApiError('POST', `/rpc/${fn}`, res.status, { expected: expect, because, got: data })
  }
  return result
}

/** Is a live session on disk for this identity? A dead token refuses
 *  everything, which reads exactly like a working rule. */
export async function sessionIsLive(session) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  const res = await fetch(`${url}/rest/v1/records?select=id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } })
  return res.ok
}
