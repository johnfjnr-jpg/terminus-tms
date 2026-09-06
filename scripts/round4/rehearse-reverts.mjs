// ── ROUND 4 PHASE 3 ITEM 3: THE THREE REVERTS, REHEARSED ────────────────
//
// Two independent one-line reverts, and the pair. Each is applied exactly as
// the comment in index.html describes it, the gate's own ledger assertions are
// run to see WHICH fail, and the tree is proved byte-identical afterwards.
//
// The expected failures are declared UP FRONT, per configuration. A revert
// that breaks something not on its list is the finding; so is one that breaks
// nothing, because that would mean nothing can tell the trees apart.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
mkdirSync(SNAP, { recursive: true })
const HTML = 'frontend/index.html'
const key = HTML.replaceAll('/', '_')

const FORM_TAG = '<script type="module" src="/opportunity-deal.js"></script>'
const CARD_TAG = '<script type="module" src="/opportunity-deal-versions.js"></script>'
const FORM_OPEN = '<!-- ── SUPERSEDED BY THE REACT BUNDLE. Round 3, Session F ──────────'
const CARD_OPEN = '<!-- ── SUPERSEDED BY THE REACT VERSION CARD. Round 4, Phase 2 ─────────'

const CONFIGS = [
  { name: 'THE CARD ALONE reverted (vanilla card, React form)',
    reverts: ['card'],
    expect: ['THE REACT VERSION CARD IS THE LIVE ONE'] },
  { name: 'THE FORM ALONE reverted (React card, vanilla form)',
    reverts: ['form'],
    expect: ['THE REACT PANEL IS THE LIVE COMMERCIALS FORM'] },
  { name: 'BOTH reverted (everything vanilla)',
    reverts: ['form', 'card'],
    expect: ['THE REACT VERSION CARD IS THE LIVE ONE',
             'THE REACT PANEL IS THE LIVE COMMERCIALS FORM'] },
]

// ── SNAPSHOT, ASSERTED ───────────────────────────────────────────────────
if (!existsSync(ROOT + HTML)) throw new Error(`SNAPSHOT: ${HTML} does not exist`)
const original = readFileSync(ROOT + HTML)
writeFileSync(SNAP + '/' + key, original)
if (!existsSync(SNAP + '/' + key)) throw new Error('SNAPSHOT NOT WRITTEN')
if (readFileSync(SNAP + '/' + key).length !== original.length) throw new Error('SNAPSHOT SIZE MISMATCH')
console.log(`snapshot verified  ${HTML}  ${original.length}B`)

const restore = () => {
  writeFileSync(ROOT + HTML, readFileSync(SNAP + '/' + key))
  if (!readFileSync(ROOT + HTML).equals(original)) throw new Error(`RESTORE MISMATCH on ${HTML} - STOPPING`)
}

/** Lifts the tag out of its comment onto its own line above it, which is the
 *  revert the comment itself describes. */
const revert = (which) => {
  const [open, tag] = which === 'form' ? [FORM_OPEN, FORM_TAG] : [CARD_OPEN, CARD_TAG]
  let s = readFileSync(ROOT + HTML, 'utf8')
  const i = s.indexOf(open)
  if (i < 0) throw new Error(`${which}: revert comment not found`)
  const close = s.indexOf('-->', i)
  const block = s.slice(i, close + 3)
  if (!block.includes(tag)) throw new Error(`${which}: the tag is not inside that comment`)
  writeFileSync(ROOT + HTML, s.slice(0, i) + tag + '\n' + block + s.slice(close + 3))
}

/** Which tags a browser would actually load, ignoring commented copies. */
const liveTags = () => {
  const raw = readFileSync(ROOT + HTML, 'utf8')
  const live = raw.replace(/<!--[\s\S]*?-->/g, '')
  return { form: live.includes(FORM_TAG), card: live.includes(CARD_TAG) }
}

// "Everything still works" is a browser claim, not a ledger one. Set
// BROWSER=1 to run the shared write path under each configuration.
const works = () => {
  if (!process.env.BROWSER) return null
  try {
    const out = execSync('node --env-file=.env scripts/round4/works-under.mjs',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? '') } }
}
const worksLines = (r) => r.out.split('\n').filter((l) => l.trim()).map((l) => l.trimEnd())
const ledger = () => {
  try {
    const out = execSync('node --test scripts/tests/live-form.test.mjs',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? '') } }
}
// DEDUPED: the runner names each failure twice, once inline and once in its
// own "failing tests:" summary, so a raw match doubles every count.
const failedNames = (out) => [...new Set(
  [...out.matchAll(/^\u2716 (.+?) \(\d/gm)].map((m) => m[1].trim()))]
// CALIBRATED, because a parser that reads zero is indistinguishable from a
// clean run: the baseline must report the same count the runner does.
const failCount = (out) => Number((out.match(/^\u2139 fail (\d+)$/m) ?? [0, '0'])[1])

let bad = 0
console.log('\nBASELINE')
const base = ledger()
console.log(`  ledger ${base.green ? 'GREEN' : '*** NOT GREEN ***'}   live tags: ${JSON.stringify(liveTags())}`)
{
  const w = works()
  if (w) {
    for (const l of worksLines(w)) console.log('  ' + l.trim())
    if (!w.green) { console.log('  *** THE SWAPPED TREE ITSELF DOES NOT WORK'); process.exit(1) }
  }
}
if (!base.green) { console.log(failedNames(base.out).join('\n')); process.exit(1) }
// The parser is proved able to read a failure before any verdict rests on it.
{
  revert('card')
  const probe = ledger()
  const n = failCount(probe.out), named = failedNames(probe.out)
  console.log(`  parser calibration: the runner counts ${n} failure(s), the parser names ${named.length}`)
  if (n === 0 || named.length !== n) {
    console.log('  *** THE PARSER CANNOT READ THIS RUNNER - every verdict below would be false')
    restore(); process.exit(1)
  }
  restore()
}

for (const cfg of CONFIGS) {
  for (const r of cfg.reverts) revert(r)
  const tags = liveTags()
  const res = ledger()
  const failed = failedNames(res.out)
  if (failCount(res.out) !== failed.length) {
    console.log(`  *** PARSER DISAGREES WITH THE RUNNER: ${failCount(res.out)} vs ${failed.length}`)
    bad++
  }
  const missing = cfg.expect.filter((e) => !failed.some((f) => f.includes(e)))
  const extra = failed.filter((f) => !cfg.expect.some((e) => f.includes(e)))

  // The revert has to be VISIBLE to the browser, or the rehearsal tested
  // nothing: a tag still inside a comment reverts nothing.
  const wantForm = cfg.reverts.includes('form')
  const wantCard = cfg.reverts.includes('card')
  const tagsRight = tags.form === wantForm && tags.card === wantCard

  console.log(`\n${cfg.name}`)
  console.log(`  live tags        ${JSON.stringify(tags)}  ${tagsRight ? 'as intended' : '*** NOT AS INTENDED ***'}`)
  console.log(`  ledger           ${res.green ? 'GREEN' : 'RED'}`)
  console.log(`  expected to fail ${cfg.expect.join(' | ')}`)
  console.log(`  actually failed  ${failed.length ? failed.join(' | ') : '(nothing)'}`)
  if (missing.length) { console.log(`  *** DID NOT FAIL: ${missing.join(' | ')}`); bad++ }
  if (extra.length) { console.log(`  *** ALSO FAILED: ${extra.join(' | ')}`); bad++ }
  if (!tagsRight) bad++
  if (!missing.length && !extra.length && tagsRight) console.log('  verdict          exactly the declared failures, and nothing else')

  const w = works()
  if (w) {
    for (const l of worksLines(w)) console.log('  ' + l.trim())
    if (!w.green) { console.log('  *** THE WRITE PATH DOES NOT WORK UNDER THIS REVERT'); bad++ }
  }

  restore()
  const backTags = liveTags()
  console.log(`  restored         ${readFileSync(ROOT + HTML).equals(original) ? 'byte-identical' : '*** DIFFERS ***'}`
    + `  live tags ${JSON.stringify(backTags)}`)
  if (backTags.form || backTags.card) { console.log('  *** A VANILLA TAG SURVIVED THE RESTORE'); bad++ }
}

console.log('\nFINAL')
const final = ledger()
console.log(`  ledger ${final.green ? 'GREEN' : '*** NOT GREEN ***'}`)
console.log(`  ${HTML} ${readFileSync(ROOT + HTML).equals(original) ? 'byte-identical to the snapshot' : '*** DIFFERS ***'}`)
if (!final.green || !readFileSync(ROOT + HTML).equals(original)) bad++
console.log(bad ? `\n*** ${bad} PROBLEM(S) ***` : '\nAll three reverts behaved exactly as their ledger declares.')
process.exit(bad ? 1 : 0)
