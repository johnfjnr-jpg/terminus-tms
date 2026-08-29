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

const SESSION_PATH = '/Users/johnfryatt/terminus-tms/session-ref.json'
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
  return JSON.parse(readFileSync(SESSION_PATH, 'utf8')).access_token
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
