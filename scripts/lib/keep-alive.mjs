// A KEEP-ALIVE FOR LONG BROWSER RUNS. UI hygiene v2 P2.1.
//
// Two session deaths landed mid-measurement in one round, each costing a
// re-run and one of them reading as a product defect until the duration was
// checked (Verification 48). A browser sweep across three records and two
// widths runs about a minute; a full calibration runs several.
//
// ── WHAT IT MUST NOT DO ───────────────────────────────────────────────────
//
// It must not paper over a genuine auth failure. A retry loop around a revoked
// token turns "the session is dead" into "the probe is slow", which is the
// exact shape this estate keeps recording: an instrument that cannot fail
// reports the answer you wanted.
//
// So the split is made on WHAT THE SESSION FILE SAYS, not on the status code
// alone:
//
//   401 AND the file says the token is near expiry  -> refresh. Normal.
//   401 AND the file says there is plenty of time   -> FAIL LOUDLY. The token
//                                                      was revoked, replaced or
//                                                      never valid, and a
//                                                      refresh would either
//                                                      mask it or spend a
//                                                      single-use token for
//                                                      nothing.
//
// Never before the gate: the gate extends the session itself, and a manual
// refresh immediately before it spends the single-use token (CLAUDE.md rule 16).
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SESSION = `${ROOT}/session-ref.json`

export function minutesLeft() {
  try {
    const s = JSON.parse(readFileSync(SESSION, 'utf8'))
    return Math.round((s.expires_at * 1000 - Date.now()) / 60000)
  } catch { return null }
}

/**
 * @param {object}  opts
 * @param {number}  opts.everyMs            how often to check
 * @param {number}  opts.refreshUnderMin    refresh when fewer minutes remain
 * @param {Function} opts.onFatal           called instead of exiting, for tests
 */
export function startKeepAlive({ everyMs = 120000, refreshUnderMin = 15, onFatal = null, log = console.error } = {}) {
  let stopped = false
  const fatal = (why) => {
    log('')
    log('  KEEP-ALIVE: STOPPING. This is an auth failure, not a slow probe.')
    log(`  ${why}`)
    log('  Recover with: node --env-file=.env scripts/sign-in.js <email> <password>')
    if (onFatal) return onFatal(why)
    process.exit(1)
  }

  const tick = async () => {
    if (stopped) return
    const left = minutesLeft()
    try {
      await api('GET', '/industries')
    } catch (e) {
      if (e?.status === 401) {
        // THE DISCRIMINATION. A healthy-looking file with a refused token is a
        // revoked or overridden token, and no amount of retrying fixes it.
        if (left === null || left > refreshUnderMin) {
          return fatal(`the session file reports ${left === null ? 'an unreadable expiry' : `${left} minutes left`}, `
            + 'but an authenticated read was refused 401. The token is revoked or overridden.')
        }
        try {
          execFileSync('node', ['--env-file=.env', 'scripts/refresh-session.js'], { cwd: ROOT, stdio: 'pipe' })
          return
        } catch (r) {
          return fatal(`the token expired and the refresh failed: ${String(r.stderr ?? r.message).slice(0, 160)}`)
        }
      }
      // Anything else is not an auth question. Reported, never fatal, because a
      // transient network blip must not kill a long run.
      log(`  keep-alive: non-auth error, continuing: ${String(e.message ?? e).slice(0, 100)}`)
      return
    }
    if (left !== null && left <= refreshUnderMin) {
      try { execFileSync('node', ['--env-file=.env', 'scripts/refresh-session.js'], { cwd: ROOT, stdio: 'pipe' }) }
      catch (r) { return fatal(`a pre-emptive refresh failed with ${left} minutes left: ${String(r.stderr ?? r.message).slice(0, 160)}`) }
    }
  }

  const handle = setInterval(() => { void tick() }, everyMs)
  handle.unref?.()
  return { stop: () => { stopped = true; clearInterval(handle) }, tick }
}
