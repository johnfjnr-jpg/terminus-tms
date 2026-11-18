// ── THE PROBE REGISTER CHECK: every probe is wired, or docs/PROBES.md says why
//
// PROBE_TRIAGE R8 (John, 2026-11-18). DESIGN_PRINCIPLES: "a probe that guards
// a shipped behaviour is wired into the gate in the round that ships it, or
// the round says why not." This makes the second half gateable: a probe or
// calibrator nobody wired and nobody explained is a red pure suite, not a
// silence (CLAUDE.md Verification 9, a detector nothing schedules rots).
//
// It replaces scripts/probe-inventory/q1-wiring.mjs, which answered the same
// question by hand, once, and was itself scheduled by nothing.
//
// WHAT IT CAN SEE AND WHAT IT CANNOT. It checks that each file HAS a
// disposition, that the disposition is TRUE where it is mechanical (WIRED is
// reached by the gate; RETIRED is gone from disk; a listed file exists), and
// that a MANUAL row carries a reason. Whether the reason is a GOOD one is
// judgement, and no check here pretends otherwise.
//
// Pure: it is handed the file list, the register text and the gate text, so the
// test can calibrate it on synthetic inputs as well as run it on the tree.

/** A file is in the population when its basename names it a probe or a calibrator. */
export const isProbeFile = (f) => /^(probe|calibrat)[^/]*\.(mjs|js|cjs)$/.test(f.split('/').pop())

const ROW = /^\|\s*`(scripts\/[^`]+)`\s*\|\s*(WIRED|MANUAL|TOOL|RETIRED)\s*\|(.*)\|\s*$/

/** Parse docs/PROBES.md's table rows: `| \`scripts/x\` | DISPOSITION | ... | why |`. */
export function parseRegister(text) {
  const rows = new Map()
  const dupes = []
  for (const line of text.split('\n')) {
    const m = ROW.exec(line)
    if (!m) continue
    const cells = m[3].split('|').map((c) => c.trim())
    if (rows.has(m[1])) dupes.push(m[1])
    rows.set(m[1], { disposition: m[2], why: cells[cells.length - 1] ?? '' })
  }
  return { rows, dupes }
}

/**
 * @param {object} a
 * @param {string[]} a.files   every file under scripts/, repo-relative
 * @param {string} a.register  docs/PROBES.md
 * @param {string} a.gate      the gate's code with comments stripped: verify-all.mjs,
 *                             run-calibrations.mjs and package.json's scripts
 * @returns {string[]} problems, each naming its file; empty when the register holds
 */
export function checkRegister({ files, register, gate }) {
  const problems = []
  const onDisk = new Set(files)
  const { rows, dupes } = parseRegister(register)
  if (rows.size === 0) problems.push('docs/PROBES.md has no register rows at all, so nothing was checked')
  for (const f of dupes) problems.push(`${f}: listed twice in docs/PROBES.md`)
  // The FULL repo path, quoted: a bare basename would let `probe-live.mjs` at
  // the root be satisfied by `sizing/probe-live.mjs` (Verification 17, a
  // substring that cannot fail).
  const reached = (f) => gate.includes(`'${f}'`) || gate.includes(`"${f}"`) || new RegExp(`(^|\\s)${f.replace(/[.]/g, '\\.')}(\\s|$)`, 'm').test(gate)

  for (const f of files.filter(isProbeFile)) {
    const r = rows.get(f)
    if (!r) { problems.push(`${f}: a probe or calibrator with no row in docs/PROBES.md (wire it, or record why not)`); continue }
    if (r.disposition === 'RETIRED') problems.push(`${f}: marked RETIRED in docs/PROBES.md but still on disk`)
    if (r.disposition === 'MANUAL' && r.why.replace(/[`*_ -]/g, '').length < 12) problems.push(`${f}: MANUAL with no stated reason`)
    if (r.disposition !== 'WIRED' && reached(f)) problems.push(`${f}: the gate runs it, but docs/PROBES.md says ${r.disposition}`)
  }
  for (const [f, r] of rows) {
    if (r.disposition === 'RETIRED') { if (onDisk.has(f) && !isProbeFile(f)) problems.push(`${f}: marked RETIRED in docs/PROBES.md but still on disk`); continue }
    if (!onDisk.has(f)) { problems.push(`${f}: listed as ${r.disposition} in docs/PROBES.md, and no such file exists`); continue }
    if (r.disposition === 'WIRED' && isProbeFile(f) && !reached(f)) problems.push(`${f}: listed as WIRED, and nothing in the gate runs it`)
  }
  return problems
}
