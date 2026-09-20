// R2's PRECONDITION: everything the retired opportunity-reference.js WROTE,
// which of those targets has a writer today, and what each one does on screen.
//
// Verification 43's clause: when a swap retires a code path, list what that
// path WROTE, not only what called it. The empty title was found by a walk;
// this asks what ELSE died in the same deletion.
//
// ── TWO INSTRUMENT CORRECTIONS, RECORDED BECAUSE BOTH WERE MINE ──────────
//
// 1. CONTAINMENT IS NOT POSITION. The first version decided "inside #ref-root"
//    by comparing BYTE OFFSETS in index.html: an id appearing after the opening
//    tag was called inside. Being after an opening tag is not being inside the
//    element, and the live DOM disagreed on `ref-reference-code`. That is
//    CLAUDE.md's "a count is not a structure" in one line. Containment is now
//    asked of the rendered document with `closest('#ref-root')`.
//
// 2. A MENTION IS NOT A WRITE. The first version scored a live writer by
//    matching the id as a string, and scored `ref-save-feedback` as written
//    because React uses that spelling as a `data-testid`. The scan now matches
//    an ASSIGNMENT through getElementById, and reports the matching line so a
//    reader can see which path writes it.
//
// V39: the retired source and every live source are read through the comment
// stripper, or prose naming these ids satisfies the scan.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-r2-retired-writes.mjs')
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCode } from '../lib/strip-comments.mjs'

const DELETED_AT = '912ad8a'
const FILE = 'frontend/opportunity-reference.js'
const OPP = process.argv[2] || '24d42569-1b0b-4378-aae9-e3aadaea876e'

const dir = mkdtempSync(join(tmpdir(), 'tms-retired-'))
const local = join(dir, 'opportunity-reference.js')
writeFileSync(local, execSync(`git show ${DELETED_AT}^:${FILE}`, { encoding: 'utf8' }))
const retired = readCode(local)

// Only ids the retired file ASSIGNED to, which is what "wrote" means here.
const wrote = new Set()
const ASSIGN = /getElementById\(\s*[`'"]([a-zA-Z0-9_$-]+)[`'"]\s*\)\s*(\??\.)?\s*(textContent|innerHTML|innerText|value|className|classList|hidden|disabled)/g
for (const m of retired.matchAll(ASSIGN)) wrote.add(m[1])
// Two-step writes: `const el = getElementById('x')` then `el.textContent = ...`
for (const m of retired.matchAll(/getElementById\(\s*[`'"]([a-zA-Z0-9_$-]+)[`'"]/g)) wrote.add(m[1])
const ids = [...wrote].sort()
console.log(`ids the retired file addressed: ${ids.length}`)

// Live writers: an ASSIGNMENT through getElementById, not a mention.
const liveFiles = ['frontend/app.js', 'frontend/anchor-popup.js',
  ...execSync('find frontend-react/src -name "*.tsx" -o -name "*.ts"', { encoding: 'utf8' }).trim().split('\n').filter(Boolean)]
const writerFor = (id) => {
  for (const f of liveFiles) {
    let c; try { c = readCode(f) } catch { continue }
    const lines = c.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(`'${id}'`) && !lines[i].includes(`"${id}"`) && !lines[i].includes('`' + id + '`')) continue
      if (/getElementById\([^)]*\)\s*(\??\.)?\s*(textContent|innerHTML|innerText|value|className|classList|hidden|disabled)/.test(lines[i]))
        return `${f}:${i + 1}  ${lines[i].trim().slice(0, 72)}`
    }
  }
  return null
}

const S = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1000 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), OPP)
  // `.is-loading > *` is `visibility: hidden`, which PRESERVES LAYOUT, so every
  // child keeps a correct non-zero box while invisible. The class is the only
  // honest signal that the record has arrived.
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    const c = document.getElementById('detail-company')
    return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 20000 })

  const live = await p.evaluate((list) => Object.fromEntries(list.map((id) => {
    const el = document.getElementById(id)
    if (!el) return [id, { present: false }]
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
    return [id, {
      present: true,
      inRefRoot: !!el.closest('#ref-root'),
      visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden',
      reservesLayout: r.width > 0 && r.height > 0,
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      display: cs.display, visibility: cs.visibility,
      text: (el.textContent || '').trim().slice(0, 28),
    }]
  })), ids)

  const orphans = []
  console.log(`\n  ${'id'.padEnd(22)} ${'live'.padEnd(26)} ${'in #ref-root'.padEnd(13)} live writer`)
  for (const id of ids) {
    const L = live[id]; const w = writerFor(id)
    if (!L.present) { console.log(`  ${id.padEnd(22)} ${'absent from the DOM'.padEnd(26)} ${'-'.padEnd(13)} ${w ? 'yes' : 'no'}`); continue }
    const state = L.visible ? `VISIBLE ${L.box}` : (L.reservesLayout ? `reserves ${L.box}` : 'no box')
    console.log(`  ${id.padEnd(22)} ${state.padEnd(26)} ${String(L.inRefRoot).padEnd(13)} ${w ? 'yes' : 'NO'}`)
    if (!L.inRefRoot && !w) orphans.push({ id, L })
  }

  console.log(`\nORPHANS: outside React's container, addressed by the retired file, written by nothing today: ${orphans.length}`)
  for (const o of orphans) console.log(`  ${o.id.padEnd(22)} ${o.L.visible ? 'VISIBLE' : (o.L.reservesLayout ? 'reserves layout ' + o.L.box : 'no box')}  text=${JSON.stringify(o.L.text)}`)

  console.log(`\nAND THE TITLE'S ONLY LIVE WRITER:`)
  console.log('  ' + (writerFor('ref-display-name') ?? 'NONE AT ALL'))
} finally { await b.close() }
