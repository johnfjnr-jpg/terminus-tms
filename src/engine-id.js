// ── THE ENGINE IDENTIFIER A SUBMISSION FREEZES (FROZEN_FIGURES R-FF1) ──────
//
// Server only: it reads git and the file system, which is why it is not in
// src/lib (served to the browser). Computed once, when the server starts; a
// `--watch` server restarts on every source change, so it is current for the
// code actually running.
//
// TWO PARTS, because each misses what the other catches: the commit names the
// tree but cannot see an uncommitted edit, and the calculator's own sha256 is
// exact for the file that priced the deal but names nothing. A commit of null
// means git could not be read; it is recorded as null, never guessed.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
let commit = null
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { commit = null }

export const ENGINE_ID = Object.freeze({
  commit,
  dealCalculatorSha256: createHash('sha256').update(readFileSync(new URL('./lib/deal-calculator.js', import.meta.url))).digest('hex'),
})
