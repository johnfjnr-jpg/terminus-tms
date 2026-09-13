// ── THE BLINDING, ON DEMAND ──────────────────────────────────────────────
//
// Two live instances already exist, which is the stronger evidence. This
// adds the controlled counterfactual the fix must close: take a select the
// scanner currently SEES, push its terminator past the window with nothing
// but a comment, and watch the scanner stop counting it - reporting FEWER
// unbounded selects, which reads as progress.
//
// Snapshot by full path, restore, compare bytes (Verification 44).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const FILE = 'scripts/tests/contact-links.test.mjs'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'scanwin-repro')
mkdirSync(SNAP, { recursive: true })
const snapPath = join(SNAP, FILE.replaceAll('/', '_'))
const original = readFileSync(join(ROOT, FILE))
writeFileSync(snapPath, original)
if (!existsSync(snapPath)) { console.error('no snapshot; refusing'); process.exit(2) }

const count = async () => {
  const m = await import(`../lib/unbounded-selects.mjs?t=${Date.now()}`)
  const found = m.findUnboundedSelects(m.gateRunFiles())
  return { total: found.length, keys: new Set(found.map((f) => f.key)) }
}

const TARGET = 'scripts/tests/contact-links.test.mjs::contact_roles::0'
try {
  const before = await count()
  console.log(`=== BEFORE ===`)
  console.log(`  scanner total: ${before.total}`)
  console.log(`  sees ${TARGET}: ${before.keys.has(TARGET)}   (must be TRUE to be worth blinding)`)
  if (!before.keys.has(TARGET)) { console.error('  target not visible; pick another'); process.exit(2) }

  const src = original.toString('utf8')
  const anchor = `  const roles = await db.from('contact_roles').select('id, label')`
  if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(2) }
  // A COMMENT. Nothing else. Placed after the select, inside the window.
  const pad = Array.from({ length: 6 }, (_, i) =>
    `  // padding line ${i} - ordinary explanatory prose of a wholly unremarkable length here`).join('\n')
  // Insert immediately after the line the chain starts on. The select is
  // all on one line here, so the insertion point is the end of that line.
  const cut = src.indexOf('\n', src.indexOf(anchor)) + 1
  writeFileSync(join(ROOT, FILE), src.slice(0, cut) + pad + '\n' + src.slice(cut))
  console.log(`\n  injected 6 lines of COMMENT after the select. No code changed.`)

  const after = await count()
  console.log(`\n=== AFTER ===`)
  console.log(`  scanner total: ${after.total}   (was ${before.total})`)
  console.log(`  sees ${TARGET}: ${after.keys.has(TARGET)}   (must be FALSE - the blinding)`)
  console.log(`\n=== VERDICT ===`)
  console.log(!after.keys.has(TARGET) && after.total < before.total
    ? `  REPRODUCED. Six comment lines removed a genuinely unbounded select from\n`
      + `  the scanner's view, and the total went DOWN from ${before.total} to ${after.total} -\n`
      + `  which reads as fewer unbounded selects, i.e. as progress.`
    : `  NOT REPRODUCED.`)
} finally {
  writeFileSync(join(ROOT, FILE), original)
  if (!readFileSync(join(ROOT, FILE)).equals(original)) { console.error('RESTORE MISMATCH'); process.exit(2) }
  console.log(`\n  restored, byte-identical to the snapshot`)
}
