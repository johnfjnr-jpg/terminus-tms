// ── THREE CLAIMS, EACH PROVEN ────────────────────────────────────────────
//
//   1. THE BLINDING IS CLOSED. The Phase 0 reproduction - six comment lines
//      that removed a real unbounded select from the scanner's view and took
//      the total from 40 to 39 - no longer works.
//   2. NO FALSE POSITIVES. The population is unchanged: the same 40 keys,
//      matching the allowlist exactly, with nothing newly flagged.
//   3. THE RAISE IS REAL. A chain the parser genuinely cannot bound makes
//      the scanner RAISE BY NAME rather than silently drop it.
//
// Claim 3 matters most: the whole round is about a guard that failed
// silently, and an unproved raise would be the same fault in a new place
// (Verification 9 - a detector never shown firing is an assertion).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'scanwin-cal')
mkdirSync(SNAP, { recursive: true })

const fresh = async () => import(`../lib/unbounded-selects.mjs?t=${Date.now()}${Math.random()}`)
const snapshot = (f) => {
  const b = readFileSync(join(ROOT, f))
  const p = join(SNAP, f.replaceAll('/', '_'))
  writeFileSync(p, b)
  if (!existsSync(p)) { console.error(`no snapshot for ${f}`); process.exit(2) }
  return b
}
const restore = (f, b) => {
  writeFileSync(join(ROOT, f), b)
  if (!readFileSync(join(ROOT, f)).equals(b)) { console.error(`RESTORE MISMATCH ${f}`); process.exit(2) }
}

let ok = true
const say = (pass, what, detail) => { if (!pass) ok = false
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`) }

// ── 2. NO FALSE POSITIVES, taken first as the baseline ───────────────────
console.log('=== 2. THE POPULATION IS UNCHANGED ===')
{
  const m = await fresh()
  const { ALLOWED, CEILING } = await import('../lib/unbounded-select-allowlist.mjs')
  const allow = new Set([...ALLOWED])
  const { found, unparseable } = m.findChains()
  const keys = new Set(found.map((f) => f.key))
  say(unparseable.length === 0, 'nothing is unparseable in the clean tree', `${unparseable.length}`)
  say(keys.size === allow.size, 'the scanner finds exactly the allowlisted set', `${keys.size} vs ${allow.size}`)
  say([...keys].every((k) => allow.has(k)), 'no NEW flags', `${[...keys].filter((k) => !allow.has(k)).length} new`)
  say([...allow].every((a) => keys.has(a)), 'no STALE entries', `${[...allow].filter((a) => !keys.has(a)).length} stale`)
  say(allow.size <= CEILING, 'the shrink-only ratchet holds', `${allow.size} / ${CEILING}`)
}

// ── 1. THE BLINDING IS CLOSED ────────────────────────────────────────────
console.log('\n=== 1. THE PHASE 0 BLINDING NO LONGER WORKS ===')
{
  const FILE = 'scripts/tests/contact-links.test.mjs'
  const TARGET = 'scripts/tests/contact-links.test.mjs::contact_roles::0'
  const orig = snapshot(FILE)
  try {
    const before = (await fresh()).findChains()
    const seenBefore = new Set(before.found.map((f) => f.key)).has(TARGET)
    const src = orig.toString('utf8')
    const anchor = `  const roles = await db.from('contact_roles').select('id, label')`
    const cut = src.indexOf('\n', src.indexOf(anchor)) + 1
    // The SAME injection as Phase 0: six lines of comment, no code changed.
    const pad = Array.from({ length: 6 }, (_, i) =>
      `  // padding line ${i} - ordinary explanatory prose of a wholly unremarkable length here`).join('\n')
    writeFileSync(join(ROOT, FILE), src.slice(0, cut) + pad + '\n' + src.slice(cut))
    const after = (await fresh()).findChains()
    const seenAfter = new Set(after.found.map((f) => f.key)).has(TARGET)
    console.log(`      total before ${before.found.length}, after ${after.found.length}`)
    say(seenBefore && seenAfter, 'six comment lines no longer hide the select',
      `seen before ${seenBefore}, seen after ${seenAfter}`)
    say(before.found.length === after.found.length, 'and the total does not silently drop',
      `${before.found.length} -> ${after.found.length}`)
  } finally { restore(FILE, orig); console.log('      restored, byte-identical') }
}

// ── 3. THE RAISE IS REAL ─────────────────────────────────────────────────
console.log('\n=== 3. AN UNPARSEABLE CHAIN RAISES BY NAME, NEVER DROPS ===')
{
  const FILE = 'scripts/tests/contact-links.test.mjs'
  const orig = snapshot(FILE)
  try {
    const src = orig.toString('utf8')
    const anchor = `  const roles = await db.from('contact_roles').select('id, label')`
    const cut = src.indexOf('\n', src.indexOf(anchor)) + 1
    // A chain whose BODY genuinely exceeds the backstop: continuation lines,
    // each a real `.filter()`, past 2000 characters.
    const long = Array.from({ length: 40 },
      (_, i) => `    .filter('col_${i}', 'eq', 'a-value-long-enough-to-add-up-here-${i}')`).join('\n')
    writeFileSync(join(ROOT, FILE), src.slice(0, cut - 1) + '\n' + long + '\n' + src.slice(cut))
    const m = await fresh()
    const { unparseable } = m.findChains()
    say(unparseable.length === 1, 'the chain is reported UNPARSEABLE', `${unparseable.length}`)
    if (unparseable.length) console.log(`      ${unparseable[0].file}:${unparseable[0].line} ${unparseable[0].table}`)
    let raised = null
    try { m.findUnboundedSelects() } catch (e) { raised = e.message }
    say(!!raised, 'findUnboundedSelects RAISES rather than returning a short list')
    say(!!raised && raised.includes('contact_roles'), 'and names the select it could not parse')
    if (raised) console.log(`      "${raised.split('\n')[0]}"`)
  } finally { restore(FILE, orig); console.log('      restored, byte-identical') }
}

const final = (await fresh()).findChains()
console.log(`\n  reverted: ${final.found.length} found, ${final.unparseable.length} unparseable`)
console.log(`\n  ${ok ? 'ALL THREE CLAIMS HOLD.' : '*** A CLAIM FAILED. ***'}`)
process.exit(ok ? 0 : 1)
