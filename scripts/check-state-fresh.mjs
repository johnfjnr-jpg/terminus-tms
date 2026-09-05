// ── IS CURRENT_STATE.md STALE? ───────────────────────────────────────────
//
// Round 2 Phase 0 item 1. The check existed only as PROSE in CLAUDE.md, which
// is why nobody noticed it was narrow: a procedure a person types is a
// procedure nobody calibrates. This is the same two tests, runnable, so it can
// be shown firing.
//
//   1. the recorded SHA is an ancestor of HEAD
//   2. no source the GENERATOR READS has changed since it
//
// THE WATCH LIST IS THE GENERATOR'S OWN INPUTS, and that is the correction.
// CLAUDE.md listed three paths; scripts/state-dump.mjs actually reads FIVE.
// `src/server.js` and `OPEN_SECURITY_STEPS.json` were missing from the list
// before the React tree existed, so the list was never complete - it was
// narrow for a reason unrelated to the migration.
//
// frontend-react/ is deliberately NOT here. The generator does not read it, so
// a change there cannot make CURRENT_STATE.md stale; adding it would report
// false staleness. That the generator records nothing about the React tree at
// all is a real gap and a different one, reported in the Phase 0 report rather
// than papered over here.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' })

// Every path scripts/state-dump.mjs reads. Keep this equal to that file's
// inputs; a generator that grows an input and leaves this alone reintroduces
// exactly the narrowness this replaced.
export const WATCHED = [
  'supabase/migrations',
  'supabase/seeds',
  'src/routes',
  'src/server.js',
  'OPEN_SECURITY_STEPS.json',
]

const state = readFileSync(join(ROOT, 'CURRENT_STATE.md'), 'utf8')
const sha = state.match(/Git commit: `([0-9a-f]{7,40})`/)?.[1]
if (!sha) {
  console.error('FAIL  CURRENT_STATE.md records no git commit. It cannot be checked for staleness.')
  process.exit(1)
}

const ancestor = git('merge-base', '--is-ancestor', sha, 'HEAD').status === 0
const changed = git('diff', '--name-only', `${sha}..HEAD`, '--', ...WATCHED)
  .stdout.split('\n').filter(Boolean)

if (!ancestor) {
  console.error(`FAIL  CURRENT_STATE.md records ${sha.slice(0, 7)}, which is not an ancestor of HEAD.`)
  console.error('      Regenerate: node --env-file=.env scripts/state-dump.mjs')
  process.exit(1)
}
if (changed.length) {
  console.error(`FAIL  CURRENT_STATE.md was generated at ${sha.slice(0, 7)} and ${changed.length} watched source(s) have changed since:`)
  for (const f of changed) console.error(`        ${f}`)
  console.error('      Regenerate: node --env-file=.env scripts/state-dump.mjs')
  process.exit(1)
}

console.log(`PASS  CURRENT_STATE.md is current at ${sha.slice(0, 7)}, ${WATCHED.length} sources watched`)
