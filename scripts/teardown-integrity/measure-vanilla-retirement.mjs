// Phase 0 item 3: what retiring the three -vanilla blocks requires.
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
const { stripJs, stripHtml } = await import('/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs')
const ROOT = '/Users/johnfryatt/terminus-tms'
const html = readFileSync(`${ROOT}/frontend/index.html`, 'utf8')

// Enumerate by the SUFFIX, never by a named list: Verification 19's clause
// about a name used as an enumeration. A fourth block must show up here.
const ids = [...new Set([...html.matchAll(/id="([\w-]+-vanilla)"/g)].map((m) => m[1]))]
console.log(`-vanilla blocks in index.html: ${ids.length}`)

// Size each block by walking its element depth, not by counting tags.
for (const id of ids) {
  const at = html.indexOf(`id="${id}"`)
  const open = html.lastIndexOf('<', at)
  let i = open, depth = 0, end = -1
  const tag = /^<(\w+)/.exec(html.slice(open))[1]
  const re = new RegExp(`</?${tag}\\b`, 'g')
  re.lastIndex = open
  for (let m; (m = re.exec(html));) {
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) { end = m.index + m[0].length; break }
  }
  const block = html.slice(open, end)
  const lines = block.split('\n').length
  const inputs = (block.match(/<(input|select|textarea|button)\b/g) ?? []).length
  console.log(`\n  ${id}: <${tag}>, ${lines} lines, ${inputs} native controls`)
  const inner = [...new Set([...block.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]))].filter((x) => x !== id)
  console.log(`     ids inside it: ${inner.length}`)
  // Which of those ids are referenced by LIVE code?
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'))
  const gate = stripJs(readFileSync(`${ROOT}/scripts/verify-all.mjs`, 'utf8'))
  const suiteText = Object.entries(pkg.scripts).map(([, v]) => v).join(' ')
  const refs = new Set()
  const liveRefs = new Set()
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) walk(p); continue }
    if (!/\.(mjs|js|ts|tsx)$/.test(e.name)) continue
    const src = stripJs(readFileSync(p, 'utf8'))
    const r = path.relative(ROOT, p)
    // LIVE means: the running application (app.js, the React tree, src/), or
    // something the gate executes. Everything else is a historical round
    // script, which cannot break because it will not run.
    const live = r.startsWith('frontend/') || r.startsWith('frontend-react/') || r.startsWith('src/')
      || gate.includes(path.basename(p)) || suiteText.includes(path.basename(p))
    for (const x of inner) {
      if (!(src.includes(`'${x}'`) || src.includes(`"${x}"`) || src.includes(`#${x}`))) continue
      refs.add(`${x} <- ${r}`)
      if (live) liveRefs.add(`${x} <- ${r}`)
    }
  }}
  walk(`${ROOT}/scripts`); walk(`${ROOT}/frontend`); walk(`${ROOT}/frontend-react/src`); walk(`${ROOT}/src`)
  console.log(`     ids referenced by code: ${refs.size} total, ${liveRefs.size} from LIVE code`)
  const byFile = new Map()
  for (const r of liveRefs) {
    const f = r.split(' <- ')[1]
    byFile.set(f, (byFile.get(f) ?? 0) + 1)
  }
  for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`        ${String(n).padStart(3)} ids  ${f}`)
  }
  if (!liveRefs.size) console.log('        (no live reference: only historical round scripts)')
}
