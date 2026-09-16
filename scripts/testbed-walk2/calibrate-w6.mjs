// ── W6'S CALIBRATION: PROVE EACH NEW DOOR ASSERTION CAN FAIL ─────────────
//
// The door test went from 12 to 21 and was green on its first run, which is
// the tell rather than the proof. Nothing here counts as evidence until the
// assertion has been watched going red on a real violating case.
//
// ── THE HARNESS'S OWN RULES, and each is a scar ─────────────────────────
//
// FULL-PATH KEYING. A backup keyed on the basename overwrote src/lib with
// src/routes in this repository, which deliberately mirrors names across the
// two. The snapshot map is keyed on the path with separators substituted.
//
// THE SNAPSHOT IS ASSERTED TO EXIST before anything is injected, and the
// restore is COMPARED BYTE FOR BYTE after every injection, stopping dead on
// a mismatch rather than compounding. Two harnesses destroyed the work they
// were calibrating, in consecutive phases, by skipping exactly this.
//
// AN IN-FLIGHT MARKER. A killed run leaves its mutation on disk, and the
// NEXT run then snapshots the mutation as the original and faithfully
// restores the damage. The marker makes that refuse rather than bless it.
//
// NODE, NOT A SHELL. `snapshot $FILES` in zsh passes four paths as one
// argument, every cp fails, the harness carries on, and nine injections land
// cumulatively. There is no word-splitting here to get wrong.
//
// THE VERDICT READS WHICH ASSERTION FAILED, NOT WHETHER THE RUN FAILED. An
// injection can kill a probe six lines before the check it was written for
// and print a confident FIRED. Each case below names the test it must
// falsify, and a red run that did not falsify THAT test is reported as
// FIRED-FOR-THE-WRONG-REASON, which is not a pass.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const SNAP = join(REPO, '.verify/walk2/calib')
const INFLIGHT = join(SNAP, 'IN-FLIGHT')
mkdirSync(SNAP, { recursive: true })

if (existsSync(INFLIGHT)) {
  console.error('REFUSING TO RUN: a previous calibration did not finish.')
  console.error(`Its snapshots are in ${SNAP}. Restore from those by hand first,`)
  console.error('because snapshotting now would bless whatever it left on disk.')
  process.exit(2)
}

// ── THE SUMMARY ANCHOR MOVED FILES, AND THE HARNESS REFUSED ────────────
//
// It was in `TestBedPanel.tsx` until the band moved to the header. On the
// first run after that move this harness stopped dead with "the anchor is
// not in TestBedPanel.tsx; refusing to inject nothing" rather than injecting
// a no-op and reporting a calibration it had not performed.
//
// That is the uniqueness-and-presence check earning its place, and it is
// Verification 9's clause arriving from the direction nobody watches: an
// anchor does not only rot when the DEFECT is fixed, it rots when the code
// it names is MOVED by a round that has nothing to do with it.
const BAND = 'frontend-react/src/testbed/TestBedBand.tsx'
const ROWS = 'frontend-react/src/field-row/useFieldRows.ts'
const FILES = [BAND, ROWS]

const key = (f) => f.replace(/[/\\]/g, '_')
const original = new Map()
for (const f of FILES) {
  const body = readFileSync(join(REPO, f), 'utf8')
  const at = join(SNAP, key(f))
  writeFileSync(at, body)
  if (!existsSync(at)) throw new Error(`the snapshot of ${f} was not written; refusing to inject`)
  if (readFileSync(at, 'utf8') !== body) throw new Error(`the snapshot of ${f} does not match it`)
  original.set(f, body)
}
writeFileSync(INFLIGHT, new Date().toISOString())

/**
 * Each case names the file, the exact text to replace, and - the important
 * part - the TEST NAME it must turn red. An anchor on the run's exit code
 * would score a syntax error as a successful calibration.
 */
const CASES = [
  {
    id: 'the Summary row leaves the surface',
    file: BAND,
    find: `        {summary
          ? (
            <div data-key="summary" className="cd-row-nolabel">
              <FieldRow field={{ ...summary, label: '' }} rows={rows} />
            </div>)
          : null}`,
    put: '        {null}',
    // THE WHOLE POINT OF W6. Before this round the refusal loop compared its
    // count to zero, so losing a row shrank the claim in silence.
    mustRedden: ['D4 and ALL 28 refuse'],
  },
  {
    id: 'the door lets everyone in',
    file: ROWS,
    find: '    if (!shell.canEditFields()) return false',
    put: '    if (false) return false',
    mustRedden: ['W6 click is REFUSED', 'W6 Enter is REFUSED',
      'W6 Space is REFUSED', 'W6 a seed character is REFUSED'],
  },
  {
    id: 'the door refuses everyone, including the owner',
    file: ROWS,
    find: '    if (!shell.canEditFields()) return false',
    put: '    if (true) return false',
    // The counterfactual's own calibration. Without these four, every
    // refusal above is satisfied by a Summary row that never opens for
    // anyone, which is a dead row wearing a closed door.
    mustRedden: ['W6 click DOES open it on my own record',
      'W6 Enter DOES open it on my own record',
      'W6 Space DOES open it on my own record',
      'W6 a seed character DOES open it on my own record'],
  },
  {
    id: 'a refused Summary row keeps its tab stop',
    file: ROWS,
    find: '  const canEdit = shell.canEditFields()',
    put: '  const canEdit = true',
    mustRedden: ['W6 a refused Summary row is not a tab stop'],
  },
]

const run = () => {
  try {
    const out = execFileSync('npx', ['vitest', 'run', 'testbed-door', '--reporter=verbose'],
      { cwd: join(REPO, 'frontend-react'), encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, out }
  } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` } }
}

/**
 * THE TEST NAMES THAT WENT RED, and the first version of this was WRONG in
 * the way Verification 16's corollary describes: the run was perfect and the
 * READING was not. It stripped the leading marker and then asked whether the
 * line STARTED WITH the test name. Vitest's verbose reporter prints the whole
 * path first -
 *
 *   × src/__tests__/testbed-door.test.tsx > D: NOT MINE ... > D4 and ALL 28 ... 41ms
 *
 * - so every match failed and all four injections reported 0/N against a run
 * that had correctly gone red. A confident "NOT the assertion it was written
 * for" on four sound calibrations.
 *
 * The name is the segment after the LAST ` > `, with the duration removed.
 */
const reddened = (out) => out.split('\n')
  .filter((l) => l.trimStart().startsWith('×'))
  .map((l) => {
    const parts = l.split(' > ')
    return parts[parts.length - 1].replace(/\s+\d+(\.\d+)?m?s\s*$/, '').trim()
  })

const results = []
for (const c of CASES) {
  const body = original.get(c.file)
  if (!body.includes(c.find)) {
    throw new Error(`the anchor for "${c.id}" is not in ${c.file}; refusing to inject nothing`)
  }
  if (body.split(c.find).length - 1 !== 1) {
    throw new Error(`the anchor for "${c.id}" is not unique in ${c.file}`)
  }
  writeFileSync(join(REPO, c.file), body.replace(c.find, c.put))
  const r = run()
  const red = reddened(r.out)
  const hit = c.mustRedden.filter((name) => red.some((l) => l.startsWith(name)))
  results.push({ id: c.id, exit: r.code, redCount: red.length,
    expected: c.mustRedden.length, hit: hit.length, red })

  // RESTORE, THEN VERIFY THE RESTORE. Not `git checkout`: that reverts to the
  // last COMMIT, and a mid-phase tree is not the last commit.
  writeFileSync(join(REPO, c.file), body)
  if (readFileSync(join(REPO, c.file), 'utf8') !== body) {
    console.error(`RESTORE MISMATCH on ${c.file}. Stopping rather than compounding.`)
    process.exit(3)
  }
}

// THE FINAL REVERTED RUN. It has been the sole witness to a broken harness
// four times in this estate's history, twice to a harness that had quietly
// become part of the thing it was measuring. It is never skipped.
const final = run()

console.log('\n  W6 CALIBRATION\n')
console.log('  injection                                        exit  red  of which expected')
for (const r of results) {
  console.log(`  ${r.id.padEnd(48)} ${String(r.exit).padEnd(5)} ${String(r.redCount).padEnd(4)} `
    + `${r.hit}/${r.expected}${r.hit === r.expected ? '' : '   <-- NOT the assertion it was written for'}`)
}
console.log(`\n  reverted run: exit ${final.code}`)
const finalLine = final.out.split('\n').find((l) => /Tests\s+\d/.test(l))
console.log(`  ${(finalLine ?? '(no summary line)').trim()}`)

for (const f of FILES) {
  if (readFileSync(join(REPO, f), 'utf8') !== original.get(f)) {
    console.error(`\n  FILE NOT RESTORED: ${f}`)
    process.exit(3)
  }
}
console.log('  every file byte-identical to its snapshot')
unlinkSync(INFLIGHT)

const bad = results.filter((r) => r.hit !== r.expected)
if (bad.length || final.code !== 0) {
  console.log('\n  CALIBRATION FAILED')
  process.exit(1)
}
console.log('\n  CALIBRATION PASSED: every new assertion was watched going red on a real violation')
