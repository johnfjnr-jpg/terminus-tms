// Filter the raw census to what the React render MUST adopt:
//   (a) it carries a rule in style.css, or
//   (b) app.js or opportunity-deal-versions.js reads it.
// Comments stripped before matching, both directions calibrated. Verification 39.
import { readFileSync, writeFileSync } from 'node:fs'
import { readCode } from '/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms/'
const SP = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/1b6522fb-c25d-40e2-84dc-a70cd31d0e6f/scratchpad/'
const raw = JSON.parse(readFileSync(SP + 'census-raw.json', 'utf8'))

const css = readCode(new URL('frontend/style.css', 'file://' + ROOT))
const app = readCode(new URL('frontend/app.js', 'file://' + ROOT))
const ver = readCode(new URL('frontend/opportunity-deal-versions.js', 'file://' + ROOT))

// CALIBRATION, both directions. A stripper that eats real code turns every
// scan built on it into a silent false negative.
const rawApp = readFileSync(ROOT + 'frontend/app.js', 'utf8')
const rawVer = readFileSync(ROOT + 'frontend/opportunity-deal-versions.js', 'utf8')
const cal = [
  // POSITIVE: real code survives the stripper.
  ['css keeps a real rule', /\.pg-card\s*\{/.test(css)],
  ['app.js keeps real code', app.includes('data-opp-tab') && app.includes('initOpportunityDealPanel')],
  ['versions keeps real code', ver.includes('deal-version-list')],
  // The stripper did something: comment box-drawing is gone from all three.
  ['comments are actually stripped', !css.includes('─') && !ver.includes('─')],
]
for (const [n, ok] of cal) if (!ok) throw new Error('CALIBRATION FAILED: ' + n)

// NEGATIVE, and this is the half that is easy to skip: a name mentioned ONLY
// in a comment must not satisfy the scan. Found by measuring rather than
// invented, so it is a real instance from these files.
// app.js embeds HTML in template literals, and an HTML comment inside a
// template is STRING DATA, so stripJs correctly leaves it. 60 box-drawing
// characters survive for exactly that reason. It is still a route by which
// prose can satisfy a scan, so it gets a second pass and its own measurement.
const appDeep = app.replace(/<!--[\s\S]*?-->/g, ' ')
const htmlCommentOnly = [...raw.ids, ...raw.cls].filter((n) => app.includes(n) && !appDeep.includes(n))
console.log('names app.js mentions ONLY inside an HTML comment in a template literal: '
  + (htmlCommentOnly.join(', ') || '<none>'))

const commentOnly = []
for (const n of [...raw.ids, ...raw.cls]) {
  for (const [label, r, stripped] of [['app.js', rawApp, app], ['versions', rawVer, ver]]) {
    if (r.includes(n) && !stripped.includes(n)) commentOnly.push(`${n} (${label})`)
  }
}
console.log('scan calibrated: ' + cal.map(([n]) => n).join('; '))
console.log('names mentioned ONLY in comments, correctly not counted as readers: '
  + (commentOnly.join(', ') || '<none found in these two files>') + '\n')

// AND app.js BUILDS IDS BY INTERPOLATION, so a literal scan is unsound for it.
// Measured: 23 interpolated DOM lookups in app.js, 0 in the versions file. The
// only FORM id any of them can reach is the panel's own, which stays static.
const interpolated = [...app.matchAll(/(getElementById|querySelector|querySelectorAll|closest)\(\s*`([^`]*\$\{[^`]*)`/g)].length
if (interpolated === 0) throw new Error('the interpolation scan found nothing; it has stopped working')
console.log(`app.js builds ${interpolated} DOM lookups by interpolation; a literal scan cannot see those.`)
console.log('measured separately: the only FORM id they can reach is opp-tab-commercial, which stays static.\n')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const styled = (sel, name) => new RegExp(`${esc(sel)}${esc(name)}(?![\\w-])`).test(css)
const readBy = (src, name) => new RegExp(`['"\`#.]${esc(name)}(?![\\w-])`).test(src)

const rows = []
for (const id of raw.ids) {
  const s = styled('#', id), a = readBy(appDeep, id), v = readBy(ver, id)
  if (s || a || v) rows.push({ kind: 'id', name: id, css: s, app: a, versions: v })
}
for (const c of raw.cls) {
  const s = styled('.', c), a = readBy(appDeep, c), v = readBy(ver, c)
  if (s || a || v) rows.push({ kind: 'class', name: c, css: s, app: a, versions: v })
}
const ids = rows.filter(r => r.kind === 'id'), cls = rows.filter(r => r.kind === 'class')
console.log(`ids:     ${ids.length} of ${raw.ids.length} must be adopted`)
console.log(`classes: ${cls.length} of ${raw.cls.length} must be adopted`)
console.log(`\nids NOT adopted (no rule, no reader): ${raw.ids.filter(i => !ids.some(r => r.name === i)).join(', ') || '<none>'}`)
console.log(`\nclasses NOT adopted: ${raw.cls.filter(c => !cls.some(r => r.name === c)).join(', ') || '<none>'}`)
writeFileSync(SP + 'census-adopt.json', JSON.stringify({ ids, cls }, null, 1))
