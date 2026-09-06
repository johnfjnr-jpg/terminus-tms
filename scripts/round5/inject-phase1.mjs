// ── ROUND 5 PHASE 1 ITEM 6: THE INJECTION SWEEP ─────────────────────────
//
// Verified-snapshot harness per Verification 44 as extended: full-path keys,
// the snapshot asserted to EXIST and match in size BEFORE anything is
// injected, the restore compared byte-for-byte AFTER EVERY injection with a
// stop on mismatch, a unique-anchor requirement, and a final reverted run.
// Node rather than a shell, because zsh does not word-split an unquoted
// variable and that is how a previous harness snapshotted nothing.
//
// Never `git checkout` as the restore: that reverts to the last COMMIT, and a
// mid-phase tree is not the last commit.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })
const key = (rel) => SNAP + '/' + rel.replaceAll('/', '_')

const R = 'frontend-react/src/'
const EDITORS = R + 'field-row/editors.tsx'
const ROW = R + 'field-row/FieldRow.tsx'
const BAR = R + 'field-row/EditBar.tsx'
const DESC = R + 'reference/descriptors.ts'
const PANEL = R + 'reference/ReferencePanel.tsx'
const KC = R + 'reference/KeyContacts.tsx'

// One injection per BEHAVIOUR FAMILY, plus the three the instruction names.
const INJECTIONS = [
  // ── the three named in the Phase 1 instruction ───────────────────────
  { name: 'THE BAR STOPS SHOWING ITS COUNT',
    family: 'finding 3',
    claim: 'the bar shows a count aggregated across the surface',
    file: BAR,
    from: `<span data-testid="dirty-count">{n === 1 ? '1 change' : \`\${n} changes\`}</span>`,
    to:   `<span data-testid="dirty-count">Save changes</span>` },

  { name: 'A READ-ONLY ROW GAINS A TAB STOP',
    family: 'behaviour 7',
    claim: 'a read-only row has no opener and NO TAB STOP',
    file: ROW,
    from: `      <div className="field-row" data-field={field.name} data-readonly="true">
        <div className="field-row-label">{field.label}</div>
        <div className="field-row-display" data-testid={\`display-\${field.name}\`}>`,
    to:   `      <div className="field-row" data-field={field.name} data-readonly="true">
        <div className="field-row-label">{field.label}</div>
        <div className="field-row-display" tabIndex={0} data-testid={\`display-\${field.name}\`}>` },

  { name: 'SAME-AS-ACCOUNT LEAVES A COPIED VALUE EDITABLE',
    family: 'item 5, B5',
    claim: 'with the flag on the six address rows are READ-ONLY',
    file: DESC,
    from: `      ? { name, label, value: str(src.account?.[ACCOUNT_SHIPPING_KEYS[i]]), readOnly: true }`,
    to:   `      ? { name, label, value: str(src.account?.[ACCOUNT_SHIPPING_KEYS[i]]) }` },

  // ── one per remaining behaviour family ───────────────────────────────
  { name: 'the seed rule names SelectEditor again (A1 reverted)',
    family: 'behaviour 4 / A1',
    claim: 'a date editor is refused a seed it cannot hold',
    file: EDITORS,
    from: `  const kind = field.editor ?? (field.options ? 'select' : 'text')
  return TAKES_SEED[kind] ?? true`,
    to:   `  return editorFor(field) !== SelectEditor` },

  { name: 'the date editor drops its min',
    family: 'A4 / finding 1',
    claim: 'a date field that declares min renders it',
    file: EDITORS,
    from: `      min={field.min}`,
    to:   `` },

  { name: 'estGoLive loses its min, exactly as the vanilla does',
    family: 'A4 / finding 1',
    claim: 'EVERY field that declares no-past gets the constraint',
    file: DESC,
    from: `    { name: 'estGoLive', label: 'Est. Go Live', editor: 'date',
      value: str(p.estGoLive), min: todayIso(now) },`,
    to:   `    { name: 'estGoLive', label: 'Est. Go Live', editor: 'date',
      value: str(p.estGoLive) },` },

  { name: 'the door is captured at render instead of consulted',
    family: 'behaviour 2',
    claim: 'the guard is consulted at EVERY entry attempt',
    file: PANEL,
    from: `  const canEdit = shell.canEditFields()`,
    to:   `  const canEdit = true` },

  { name: 'the checkbox reports a boolean instead of a string',
    family: 'finding 1',
    claim: 'a value is always a string, so dirty by comparison works',
    file: EDITORS,
    from: `      onChange={(e) => onChange(e.target.checked ? 'true' : '')}`,
    to:   `      onChange={(e) => onChange(String(e.target.checked))}` },

  { name: 'a key-contact edit joins the batched save',
    family: 'item 4',
    claim: 'key-contact writes are immediate and never ride the bar',
    file: KC,
    from: `                    setArmed((a) => ({ ...a, [l.id]: true }))
                  }}>
                  <option value="">--</option>`,
    to:   `                  }}>
                  <option value="">--</option>` },

  { name: 'the suffix REACHES THE VALUE',
    family: 'A3',
    claim: 'the suffix is display-only and never reaches the value',
    file: EDITORS,
    from: `      inputMode={field.inputMode}
      onChange={(e) => onChange(e.target.value)}`,
    to:   `      inputMode={field.inputMode}
      onChange={(e) => onChange(e.target.value + (field.suffix ?? ''))}` },

  { name: 'the suffix stops being displayed at all',
    family: 'A3',
    claim: 'the suffix IS shown in the display half',
    file: ROW,
    from: `              {field.suffix ? <span className="field-row-suffix"> {field.suffix}</span> : null}
            </>`,
    to:   `            </>` },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]
const original = new Map()
for (const rel of FILES) {
  if (!existsSync(ROOT + rel)) throw new Error(`SNAPSHOT: ${rel} does not exist`)
  const bytes = readFileSync(ROOT + rel)
  writeFileSync(key(rel), bytes)
  original.set(rel, bytes)
}
for (const rel of FILES) {
  if (!existsSync(key(rel))) throw new Error(`SNAPSHOT NOT WRITTEN for ${rel}`)
  if (readFileSync(key(rel)).length !== original.get(rel).length) {
    throw new Error(`SNAPSHOT SIZE MISMATCH for ${rel}`)
  }
  console.log(`snapshot verified  ${rel}  ${original.get(rel).length}B`)
}
if (new Set(FILES.map(key)).size !== FILES.length) throw new Error('SNAPSHOT KEY COLLISION')

const restore = (rel) => {
  writeFileSync(ROOT + rel, readFileSync(key(rel)))
  if (!readFileSync(ROOT + rel).equals(original.get(rel))) {
    throw new Error(`RESTORE MISMATCH on ${rel} - STOPPING`)
  }
}
const suite = () => {
  const started = Date.now()
  try {
    const out = execSync('npm --prefix frontend-react run test', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out, ms: Date.now() - started }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started } }
}
const line = (out) => (out.match(/Tests {2}.*$/m) ?? ['<no result>'])[0].trim()
const failed = (out) => [...new Set([...out.matchAll(/^\s*×\s+(.+?)\s+\d+ms$/gm)].map((m) => m[1].trim()))]

console.log('\nBASELINE')
const base = suite()
console.log(`  ${base.green ? 'GREEN' : '*** NOT GREEN ***'}  ${line(base.out)}  ${base.ms}ms`)
if (!base.green) { console.log(failed(base.out).slice(0, 5).join('\n')); process.exit(1) }
const BASE_MS = base.ms

const results = []
for (const inj of INJECTIONS) {
  const src = readFileSync(ROOT + inj.file, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) {
    results.push({ ...inj, verdict: hits === 0 ? 'ANCHOR NOT FOUND' : `ANCHOR NOT UNIQUE (${hits})`, caught: [] })
    restore(inj.file)
    continue
  }
  writeFileSync(ROOT + inj.file, src.replace(inj.from, inj.to))
  const r = suite()
  // Verification 48: a run far under the baseline's duration has not run.
  const noResult = !/Tests {2}/.test(r.out)
  results.push({ ...inj,
    verdict: noResult ? 'NO RESULT (harness)' : r.green ? 'SILENT' : 'DETECTED',
    line: line(r.out), ms: r.ms, caught: failed(r.out).slice(0, 3) })
  restore(inj.file)
}

console.log('\nFINAL REVERTED RUN')
const final = suite()
console.log(`  ${final.green ? 'GREEN' : '*** REVERTED RUN NOT GREEN ***'}  ${line(final.out)}`)
for (const rel of FILES) {
  console.log(`  ${readFileSync(ROOT + rel).equals(original.get(rel)) ? 'identical' : '*** DIFFERS ***'}  ${rel}`)
}

console.log('\n── SWEEP ───────────────────────────────────────────────────────')
console.log(`  baseline ${BASE_MS}ms; a run far under that has not run`)
for (const r of results) {
  console.log(`\n${r.verdict.padEnd(20)} ${r.name}`)
  console.log(`  family  ${r.family}`)
  console.log(`  claim   ${r.claim}`)
  if (r.line) console.log(`  suite   ${r.line}  ${r.ms}ms`)
  for (const c of r.caught) console.log(`  caught  ${c}`)
}
const bad = results.filter((r) => r.verdict !== 'DETECTED')
console.log(`\n${results.length - bad.length}/${results.length} detected`)
if (bad.length) {
  console.log('\nNOT DETECTED - each names a claim with no detector (Verification 51):')
  for (const b of bad) console.log(`  ${b.verdict}: ${b.claim}`)
}
process.exit(bad.length ? 1 : 0)
