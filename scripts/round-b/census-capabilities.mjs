// ── R5's SAFETY-CRITICAL HALF: WHAT THE BESPOKE SCREEN DOES ──────────────
//
// Verification 49's clause, and this estate has already paid for it once:
//
//   "A CENSUS OF FIELDS IS NOT A CENSUS OF THE SURFACE... The swap then
//    removed five working capabilities from the screen, because not one of
//    them is a field."
//
// So this maps every component the bespoke screen RENDERS to a named
// capability, and treats an unmapped one as a finding. A capability nobody
// has enumerated is a capability the retirement silently deletes.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripJs } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const BESPOKE = [
  'frontend-react/src/contact/ContactHost.tsx',
  'frontend-react/src/contact/ContactView.tsx',
  'frontend-react/src/contact/ContactPanel.tsx',
]
const SHARED = [
  'frontend-react/src/leads/LeadCard.tsx',
  'frontend-react/src/leads/LeadCardActions.tsx',
  'frontend-react/src/leads/QualifyCompletion.tsx',
]
// A JSX ELEMENT, NOT A TYPE PARAMETER. The first version matched
// `<([A-Z]...)` anywhere and reported six TypeScript generics -
// `useState<BlockingState>`, `useState<ContactLike>` - as unmapped
// CAPABILITIES. In a census whose whole output is "what would the
// retirement delete", six phantoms is worse than a miscount: it is noise in
// the safety-critical list.
//
// The discriminator is the character BEFORE the `<`. A generic follows an
// identifier (`useState<`), a JSX element follows whitespace, `(`, `{`, `>`
// or the start of a line.
const JSX_OPEN = /(^|[\s(){}>])<([A-Z][A-Za-z0-9]*)[\s/>]/gm
const renderedBy = (files) => {
  const out = new Set()
  for (const f of files) {
    const src = stripJs(readFileSync(join(ROOT, f), 'utf8'))
    for (const m of src.matchAll(JSX_OPEN)) out.add(m[2])
  }
  return out
}
// Declarations counted in EVERY form. A prior census anchored on
// function/const/let at line start and missed fifteen `window.X = function`
// names - a fifth of a file.
const DECL = [
  /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
  /^\s*window\.([A-Za-z_$][\w$]*)\s*=/,
]
let declCount = 0
for (const f of BESPOKE) {
  const src = stripJs(readFileSync(join(ROOT, f), 'utf8'))
  for (const line of src.split('\n')) for (const re of DECL) if (re.test(line)) { declCount++; break }
}

const CAPABILITY = {
  ContactPanel: 'view and edit the contact FIELDS',
  FieldRow: 'view and edit the contact FIELDS',
  NotesHistory: 'read and add NOTES',
  FollowUpTask: 'set a FOLLOW-UP TASK',
  ParkForm: 'PARK the contact, with a date and a reason',
  LinkAccountPanel: 'LINK, CHANGE or CREATE the account',
  AccountDetailsModal: "view and edit the ACCOUNT'S OWN DETAILS",
  StageActions: 'advance the contact through its STAGES, and create from it',
  ContactView: 'the view shell: load, navigation token, back',
  ContactHost: 'the host: data, refresh, the shared discard dialogue',
}

const bespoke = renderedBy(BESPOKE)
const shared = renderedBy(SHARED)
console.log(`=== THE BESPOKE SCREEN RENDERS ${bespoke.size} COMPONENTS ===`)
const unmapped = []
for (const r of [...bespoke].sort()) {
  const cap = CAPABILITY[r]
  if (cap) console.log(`  ${r.padEnd(22)} ${cap}`)
  else { console.log(`  ${r.padEnd(22)} ** UNMAPPED **`); unmapped.push(r) }
}
console.log(`\n=== THE SHARED SURFACE RENDERS ${shared.size} ===`)
console.log(`  ${[...shared].sort().join('  ')}`)

const HOSTISH = /^Contact(Host|View|Panel)$/
const gap = [...bespoke].filter((r) => !shared.has(r) && CAPABILITY[r] && !HOSTISH.test(r))
console.log('\n=== THE GAP: what the bespoke screen does and the shared surface does NOT ===')
for (const g of gap.sort()) console.log(`  ${g.padEnd(22)} ${CAPABILITY[g]}`)
if (!gap.length) console.log('  (none)')
console.log(`\n  top-level declarations across the three bespoke files: ${declCount}`)
console.log(`  UNMAPPED components: ${unmapped.length}`)

// CALIBRATION, both directions, on synthetic input.
// CALIBRATED BOTH WAYS, and the generic case is the one that matters.
const synth = '<Foo /> <BarBaz>x</BarBaz> const a = useState<NotAComponent>(1) <div />'
const found = [...synth.matchAll(JSX_OPEN)].map((m) => m[2])
console.log(`\nCALIBRATION  finds real elements:        ${JSON.stringify(found)}`)
console.log(`             excludes a TYPE PARAMETER: ${!found.includes('NotAComponent')}`)
console.log(`             excludes a lowercase tag:  ${!found.includes('div')}`)
if (found.length !== 2 || found.includes('NotAComponent')) {
  console.log('CALIBRATION FAILED - the census is not evidence'); process.exit(1) }
writeFileSync(join(ROOT, 'scripts/round-b/capabilities.json'),
  JSON.stringify({ bespoke: [...bespoke], shared: [...shared], gap, unmapped }, null, 1))
