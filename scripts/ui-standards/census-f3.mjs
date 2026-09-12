// ── S5's INVENTORY: UNCLASSED CONTROLS AND UNDEFINED CSS VARS ────────────
//
// The F3 class, enumerated so it can be retired rather than counted again.
//
// ENUMERATED BY STRUCTURE, NOT BY NAME. Verification 19: a name used as an
// enumeration fails by silent omission, and F3's own history is a list of
// instances found one at a time by opening screenshots. This asks a
// structural question instead - does this control carry ANY class the
// stylesheet defines? - so a control nobody has thought of is still counted.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { stripJs, stripCss } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// ── THE POPULATION: the lead card's own component graph ─────────────────
// A VIEW IS EVERY FILE THAT WRITES INTO ITS CONTAINER (Verification 49), so
// the population is the import closure from LeadCard, not the leads/ folder.
const closure = (entry) => {
  const seen = new Set(), out = []
  const visit = (f) => {
    if (seen.has(f)) return
    seen.add(f); out.push(f)
    let src; try { src = readFileSync(f, 'utf8') } catch { return }
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const base = resolve(dirname(f), m[1])
      for (const ext of ['', '.tsx', '.ts', '.js']) {
        try { readFileSync(base + ext, 'utf8'); visit(base + ext); break } catch { /* next */ }
      }
    }
  }
  visit(entry)
  return out
}
// ── AND THE CLOSURE IS TOO WIDE ON ITS OWN ──────────────────────────────
//
// An import closure follows ANY import, including a type or a helper.
// `AccountPicker` imports `findAccountMatches` from `LinkAccountPanel`, so
// the closure drags in five controls belonging to a component the card
// stopped rendering last round. Verification 25's population clause: a
// too-wide population returns a confident, plausible, wrong number.
//
// THE STRUCTURAL NARROWING IS JSX USAGE. A component renders on the card only
// if something in the card's tree writes `<Name` for it. Walked from LeadCard
// outward, so a component reachable only through a function import is
// correctly excluded.
const renderClosure = (entry) => {
  const seen = new Set(), out = []
  const visit = (f) => {
    if (seen.has(f)) return
    seen.add(f); out.push(f)
    let src; try { src = stripJs(readFileSync(f, 'utf8')) } catch { return }
    const used = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]))
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const names = m[1].split(',').map((x) => x.replace(/\s+as\s+.*/, '').trim())
      if (!names.some((n) => used.has(n))) continue
      const base = resolve(dirname(f), m[2])
      for (const ext of ['', '.tsx', '.ts', '.js']) {
        try { readFileSync(base + ext, 'utf8'); visit(base + ext); break } catch { /* next */ }
      }
    }
  }
  visit(entry)
  return out
}
const ENTRY = join(ROOT, 'frontend-react/src/leads/LeadCard.tsx')
const RENDERED = new Set(renderClosure(ENTRY).filter((f) => /\.(tsx|ts)$/.test(f)))
const FILES = closure(ENTRY).filter((f) => /\.(tsx|ts)$/.test(f))
const dropped = FILES.filter((f) => !RENDERED.has(f))
console.log(`import closure: ${FILES.length} files;  RENDER closure: ${RENDERED.size}`)
console.log(`  reachable by import but NOT rendered on the card: ${dropped.map((f) => f.split('/').pop()).join(' ') || '(none)'}`)

// ── WHAT THE STYLESHEET DEFINES ─────────────────────────────────────────
const css = stripCss(readFileSync(join(ROOT, 'frontend/style.css'), 'utf8'))
const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim())
const definedClasses = new Set()
for (const sel of selectors)
  for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) definedClasses.add(m[1])
const definedVars = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
const usedVars = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))]

// ── EVERY CONTROL IN THE POPULATION ─────────────────────────────────────
// A control is what the DOOR calls a control: a native form element. That is
// the definition the estate already shares, so this instrument does not
// invent a second one - Verification 20's remedy.
const CONTROL = /<(button|input|textarea|select)\b([^>]*)>/gs
const controls = []
for (const f of FILES) {
  const src = stripJs(readFileSync(f, 'utf8'))
  const rel = relative(ROOT, f)
  for (const m of src.matchAll(CONTROL)) {
    const [, tag, attrs] = m
    const cls = /className=["'{]([^"'}]*)/.exec(attrs)?.[1] ?? ''
    const tid = /data-testid=[{"']?[`"']?([^"'`}]*)/.exec(attrs)?.[1] ?? ''
    const line = src.slice(0, m.index).split('\n').length
    const names = cls.split(/[\s`${}]+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c))
    controls.push({ file: rel, line, tag, testid: tid, rendered: RENDERED.has(f),
      classes: names, styled: names.some((c) => definedClasses.has(c)) })
  }
}

const onCard = controls.filter((c) => c.rendered)
const unstyled = onCard.filter((c) => !c.styled)
const offCard = controls.filter((c) => !c.rendered && !c.styled)
const undefinedVars = usedVars.filter((v) => !definedVars.has(v))

console.log(`\n=== CONTROLS RENDERED ON THE CARD: ${onCard.length}, of which ${unstyled.length} carry NO defined class ===`)
for (const c of unstyled)
  console.log(`  UNCLASSED  ${c.file.replace('frontend-react/src/', '')}:${c.line}  <${c.tag}>  ${c.testid || '(no testid)'}`
    + (c.classes.length ? `  [classes present but undefined: ${c.classes.join(' ')}]` : '  [no class at all]'))
console.log(`\n  NOT on the card, so NOT this round's (frozen Lead Detail's own): ${offCard.length}`)
for (const c of offCard) console.log(`    ${c.file.replace('frontend-react/src/', '')}:${c.line}  ${c.testid}`)
console.log(`\n=== the ${onCard.length - unstyled.length} card controls that ARE classed, by treatment ===`)
const byClass = {}
for (const c of onCard.filter((x) => x.styled))
  for (const n of c.classes.filter((n) => definedClasses.has(n)))
    (byClass[n] ??= []).push(`${c.file.split('/').pop()}:${c.line}`)
for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1].length - a[1].length))
  console.log(`  .${k.padEnd(22)} ${String(v.length).padStart(2)}  ${v.slice(0, 4).join(' ')}`)

console.log(`\n=== CSS VARS: ${usedVars.length} used, ${undefinedVars.length} NEVER DEFINED ===`)
for (const v of undefinedVars) {
  const sites = [...css.matchAll(new RegExp(String.raw`([^{}\n]*var\(${v}[^)]*\)[^;]*)`, 'g'))].map((m) => m[1].trim())
  const allFallback = sites.every((s) => new RegExp(String.raw`var\(${v}\s*,`).test(s))
  console.log(`  ${v}   ${sites.length} use site(s), every one carries a literal fallback: ${allFallback}`)
  for (const s of sites.slice(0, 3)) console.log(`      ${s.slice(0, 78)}`)
}

// ── CALIBRATION, BOTH DIRECTIONS, ON SYNTHETIC INPUT ────────────────────
const synth = `<button className="btn-sm">a</button><button>b</button><input className="nope-not-real" />`
const found = [...synth.matchAll(CONTROL)].map((m) => {
  const cls = /className=["'{]([^"'}]*)/.exec(m[2])?.[1] ?? ''
  return cls.split(/\s+/).filter(Boolean).some((c) => definedClasses.has(c))
})
console.log(`\nCALIBRATION  a classed control reads styled:     ${found[0] === true}`)
console.log(`             a bare control reads UNCLASSED:     ${found[1] === false}`)
console.log(`             an invented class reads UNCLASSED:  ${found[2] === false}`)
console.log(`             a known var reads defined:          ${definedVars.has('--green')}`)
if (!(found[0] && !found[1] && !found[2] && definedVars.has('--green'))) {
  console.log('CALIBRATION FAILED - the census is not evidence'); process.exit(1)
}
writeFileSync(join(ROOT, 'scripts/ui-standards/census-f3.json'),
  JSON.stringify({ controls, unstyled, undefinedVars }, null, 1))
