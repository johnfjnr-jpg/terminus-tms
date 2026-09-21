// ITEM 2: THE WRITER CENSUS, taken BEFORE anything is removed.
//
// Every id inside the two retired blocks is DUPLICATED by the React tree, and
// `getElementById` returns the FIRST in document order - which is the vanilla.
// So a writer naming one of these ids is writing into markup that renders
// nothing TODAY, and after the removal the same call reaches the REACT
// element instead. That change of target is the risk this census exists to
// surface, and it is why the count alone is not the finding.
//
// Read through the comment stripper (V39): several of these files discuss
// these ids at length in prose, and a raw scan calls every mention a writer.
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms/'
const html = readFileSync(ROOT + 'frontend/index.html', 'utf8')

const blockIds = (name) => {
  const i = html.indexOf(`<div id="${name}"`)
  let depth = 0, j = i
  for (;;) {
    const m = /<div\b|<\/div>/g
    m.lastIndex = j
    const r = m.exec(html)
    if (!r) break
    if (r[0].startsWith('<div')) depth++
    else { depth--; if (depth === 0) { j = r.index + r[0].length; break } }
    j = r.index + r[0].length
  }
  const block = html.slice(i, j)
  return { ids: [...new Set([...block.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))], block }
}
const FORM = blockIds('deal-form-vanilla')
const VER = blockIds('deal-version-vanilla')
const ALL = new Set([...FORM.ids, ...VER.ids])

// Everything that could name an id, code only.
const walk = (d) => readdirSync(ROOT + d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() && !['node_modules', 'dist', '.git'].includes(e.name)
    ? walk(`${d}/${e.name}`)
    : (/\.(m?js|ts|tsx)$/.test(e.name) ? [`${d}/${e.name}`] : []))
const files = [...walk('frontend'), ...walk('frontend-react/src'), ...walk('scripts'), ...walk('src')]

// A WRITE is a call that CHANGES the element. A read is not.
const WRITE = /\.(textContent|innerHTML|innerText|value|checked|disabled|className)\s*=|\.classList\.(add|remove|toggle)|\.setAttribute\(|\.style\./
const hits = []
for (const f of files) {
  const code = readCode(new URL('file://' + ROOT + f))
  const lines = code.split('\n')
  lines.forEach((line, n) => {
    const m = [...line.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]|querySelector(?:All)?\(\s*['"`]#([^'"`\s\[\.]+)/g)]
    for (const g of m) {
      const id = g[1] ?? g[2]
      if (!ALL.has(id)) continue
      // A write may continue onto the next line.
      const window2 = line + '\n' + (lines[n + 1] ?? '')
      hits.push({ f, line: n + 1, id, write: WRITE.test(window2),
        block: FORM.ids.includes(id) ? 'form' : 'version', text: line.trim().slice(0, 96) })
    }
  })
}
const byFile = {}
for (const h of hits) (byFile[h.f] ??= []).push(h)

console.log(`ids: ${FORM.ids.length} in deal-form-vanilla, ${VER.ids.length} in deal-version-vanilla\n`)
console.log(`call sites naming one of them: ${hits.length}, across ${Object.keys(byFile).length} file(s)\n`)
for (const [f, hs] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  const w = hs.filter((h) => h.write).length
  console.log(`${f}   ${hs.length} site(s), ${w} WRITE`)
}
console.log('\n── THE WRITERS, which are what a removal re-points ──')
for (const [f, hs] of Object.entries(byFile)) {
  const w = hs.filter((h) => h.write)
  if (!w.length) continue
  console.log(`\n${f}`)
  for (const h of w) console.log(`  :${h.line}  ${h.id}  |  ${h.text}`)
}
