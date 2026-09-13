// ── Q3: WHICH PROBES MEASURE A PROPERTY A BROKEN STATE ALSO SATISFIES ────
//
// BOUNDED BY RULING (R3). This is the four families this estate has PROVEN,
// measured across the population, plus a hand-audited sample. It is NOT a
// general search for blindness and does not claim to be.
//
// Verification 39: comments are stripped before matching, or prose about a
// scrollbar satisfies a scan for scrollbar reads.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, kindOf } from '../lib/strip-comments.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p, out) }
    else if (/\.(mjs|js|ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = [...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'frontend-react/src'))]
  .map((f) => relative(ROOT, f))
const src = new Map(files.map((f) => [f, stripComments(readFileSync(join(ROOT, f), 'utf8'), kindOf(f))]))

// ── THE FOUR PROVEN FAMILIES ─────────────────────────────────────────────
const FAMILIES = {
  'headless-blind: scrollbar geometry': {
    // offsetHeight-clientHeight / offsetWidth-clientWidth, or ::-webkit-scrollbar
    // reads. Proven blind headless in NEW LEAD GRID WIDTH.
    hit: (s) => /offset(?:Height|Width)\s*-\s*\w*\.?client(?:Height|Width)|scrollbar/i.test(s),
    // A file that launches headed is NOT blind.
    mitigated: (s) => /headless:\s*false/.test(s),
  },
  'attribute vs visibility': {
    // el.hidden / hasAttribute('hidden') where the cascade decides.
    hit: (s) => /\.hidden\b|hasAttribute\(\s*['"]hidden['"]\s*\)/.test(s),
    mitigated: (s) => /getComputedStyle|offsetParent|checkVisibility/.test(s),
  },
  'property vs outcome: scrollable': {
    hit: (s) => /scroll(?:Width|Height)\s*>\s*\w*\.?client(?:Width|Height)/.test(s),
    // Mitigated when the probe ALSO measures what a person sees.
    mitigated: (s) => /getBoundingClientRect/.test(s),
  },
  'wrong axis: scrollTop without scrollLeft': {
    hit: (s) => /scrollTop/.test(s),
    mitigated: (s) => /scrollLeft/.test(s),
  },
}

// ── CALIBRATION (R2): a KNOWN-blind file must be flagged, a KNOWN-
// discriminating one must not. Both are real files in this estate.
const KNOWN_BLIND = 'scripts/grid-width/probe-p0.mjs'      // headless scrollbar read, proven blind
const KNOWN_GOOD  = 'scripts/grid-width/probe-p1.mjs'      // headed, proven discriminating
const fam = FAMILIES['headless-blind: scrollbar geometry']
const flag = (f) => fam.hit(src.get(f) ?? '') && !fam.mitigated(src.get(f) ?? '')
console.log('=== Q3 CALIBRATION (the headless-blind family) ===')
console.log(`  known BLIND  ${KNOWN_BLIND}`)
console.log(`     flagged: ${flag(KNOWN_BLIND)}   (must be TRUE)`)
console.log(`  known GOOD   ${KNOWN_GOOD}`)
console.log(`     flagged: ${flag(KNOWN_GOOD)}   (must be FALSE)`)
const calOk = flag(KNOWN_BLIND) && !flag(KNOWN_GOOD)
console.log(calOk
  ? '  CALIBRATED: it separates a proven-blind read from a proven-discriminating one.\n'
  : '  *** NOT CALIBRATED - the numbers below mean nothing. ***\n')

// Verification 39's Round 8 clause: the scan must not match its OWN source.
const SELF = 'scripts/probe-inventory/q3-blind.mjs'
console.log(`  self-match guard: this file flagged by its own family scan: ${flag(SELF)}  (expected TRUE, it quotes the patterns)`)
console.log(`  -> excluded by name from every count below, and said so rather than silently skipped.\n`)

// ── DETECTORS ONLY, AND THE DISTINCTION IS THE POINT ────────────────────
//
// The first run flagged `StagePanel.tsx`, `Modal.tsx` and `VersionCard.tsx`
// for the attribute-vs-visibility family. Those are PRODUCTION COMPONENTS
// SETTING `hidden`, which is correct behaviour and not a measurement at
// all. Only a file that ASSERTS can assert blindly.
//
// Same fault as the Q1 first draft, which counted libraries as detectors:
// a population defined by a string match rather than by what the file DOES.
const isDetector = (f) => /\.test\.(mjs|ts|tsx)$/.test(f)
  || /^scripts\/.*(probe|census|calibrate|walk|inject|verify|check)/.test(f)
const detectors = files.filter(isDetector)
console.log(`  population: ${files.length} files, of which ${detectors.length} are DETECTORS`)
console.log(`  (a component setting \`hidden\` is behaviour; only an assertion can be blind)\n`)

console.log('=== Q3 RESULT, by family, DETECTORS ONLY ===')
const report = {}
for (const [name, f] of Object.entries(FAMILIES)) {
  const hits = detectors.filter((x) => x !== SELF && f.hit(src.get(x)))
  const blind = hits.filter((x) => !f.mitigated(src.get(x)))
  report[name] = { hits: hits.length, blind }
  console.log(`\n  ${name}`)
  console.log(`     files touching it : ${hits.length}`)
  console.log(`     WITHOUT the mitigation : ${blind.length}`)
  for (const b of blind) console.log(`        ${b}`)
}
if (!calOk) process.exit(2)
