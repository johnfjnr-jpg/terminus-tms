// ── THE COMMITTED BUNDLE MATCHES THE SOURCE THAT PRODUCED IT ─────────────
//
// Migration Round 1, Phase 3. `frontend-react/dist/terminus-react.js` is
// COMMITTED, so a clean checkout serves a working approval view without a
// build step. That makes it a SECOND READER of frontend-react/src
// (Verification 20), and a second reader always drifts: edit a component,
// forget to build, and the repository holds a bundle that renders the previous
// version of the screen. Nothing else in the gate can see that.
//
// The server's startup guard covers the bundle being ABSENT. This covers it
// being STALE, which is the worse failure because the screen still works and
// simply shows the wrong thing.
//
// WHY A REBUILD-AND-DIFF RATHER THAN A TIMESTAMP. A timestamp answers "was the
// file written after the source", which is true of a build of DIFFERENT source
// and false after a checkout that writes both at once. The only question worth
// asking is whether this source produces this bundle, and the only instrument
// that answers it is the build.
//
// DETERMINISM IS A PRECONDITION AND IT WAS MEASURED, not assumed: three builds,
// including one after deleting dist entirely, produced the same sha256. If that
// ever stops being true the right move is to report the offending output, not
// to loosen the comparison.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync, cpSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIST = join(ROOT, 'frontend-react', 'dist')
const BUNDLE = join(DIST, 'terminus-react.js')

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const fail = (msg) => { console.error(`FAIL  ${msg}`); process.exit(1) }

if (!existsSync(BUNDLE)) {
  fail('frontend-react/dist/terminus-react.js is not committed. '
    + 'The server serves it at /app/ and a checkout without it renders a blank approval view. '
    + 'Run: npm run build:react, and commit the result.')
}

const committed = sha(BUNDLE)

// The committed bundle is preserved and RESTORED whatever happens, so a gate
// run never leaves the working tree different from how it found it. Keyed on
// the full path rather than the basename (Verification 44).
const held = mkdtempSync(join(tmpdir(), 'tms-dist-'))
cpSync(DIST, join(held, 'dist'), { recursive: true })

let rebuilt = null
let buildFailed = null
try {
  const r = spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) buildFailed = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(0, 1200)
  else if (!existsSync(BUNDLE)) buildFailed = 'the build reported success and produced no bundle'
  else rebuilt = sha(BUNDLE)
} finally {
  rmSync(DIST, { recursive: true, force: true })
  cpSync(join(held, 'dist'), DIST, { recursive: true })
  rmSync(held, { recursive: true, force: true })
}

if (buildFailed) fail(`frontend-react does not build.\n${buildFailed}`)

if (committed !== rebuilt) {
  console.error('FAIL  the committed bundle is not what this source builds.')
  console.error(`      committed  sha256 ${committed}`)
  console.error(`      rebuilt    sha256 ${rebuilt}`)
  console.error('')
  console.error('      Either the source changed without a rebuild, or the build is not')
  console.error('      deterministic. Run `npm run build:react` and commit the result; if the')
  console.error('      hash still moves on a second run with no source change, that is a')
  console.error('      finding about the build and needs a ruling, not a looser comparison.')
  process.exit(1)
}

console.log(`PASS  committed bundle matches its source  sha256 ${committed.slice(0, 16)}`)
