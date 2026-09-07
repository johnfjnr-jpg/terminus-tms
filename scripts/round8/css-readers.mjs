// What the `.is-not-mine` class BUYS, measured from the stylesheet.
import { readCode } from '../lib/strip-comments.mjs'
const ROOT = new URL('../../', import.meta.url)
const css = readCode(new URL('frontend/style.css', ROOT), 'css')

// Every rule whose selector list mentions the class, with its declarations.
const rules = []
for (const m of css.matchAll(/([^{}]*\.is-not-mine[^{}]*)\{([^}]*)\}/g)) {
  rules.push({
    selectors: m[1].trim().split(',').map((x) => x.trim()).filter(Boolean),
    decls: m[2].trim().replace(/\s+/g, ' '),
  })
}
if (!rules.length) { console.error('REFUSED: no rules parsed, so this is vacuous'); process.exit(2) }

let sel = 0
console.log(`.is-not-mine RULES: ${rules.length}\n`)
for (const r of rules) {
  sel += r.selectors.length
  console.log(`  ${r.selectors.length} selector(s): { ${r.decls} }`)
  for (const s of r.selectors) console.log(`      ${s}`)
}
console.log(`\n  ${sel} selectors in total.`)

// Which of them target elements the REACT tree renders.
const REACT_TARGETS = [
  '.field-row-display', '.field-edit-bar', '.ref-field-display', '.cd-name-display',
  'input', 'textarea', 'select', '.btn-primary', '.btn-secondary', '.btn-sm', '.btn-ghost',
  '[role="switch"]', '.deal-toggle', '.is-inert-action', '.ref-same-as-account',
]
const covered = new Set()
for (const r of rules) for (const s of r.selectors) {
  for (const t of REACT_TARGETS) if (s.includes(t)) covered.add(t)
}
console.log(`\n  TARGETS the class dims or disables: ${[...covered].sort().join(', ')}`)
