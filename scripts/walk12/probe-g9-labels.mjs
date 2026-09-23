// G9: LABEL CONTRAST, AT THE MECHANISM
//
// The finding is not "one label looks dim". It is that two labels from the
// SAME census entry list render in different colours, which means the colour
// is a property of where a field happens to be drawn rather than of what it
// is. A census of tokens is the only thing that can say so.
//
// ── THE MEASURE IS WCAG CONTRAST AGAINST THE SURFACE BEHIND IT ──────────
//
// Not "is it the right token" - that is the fix, not the requirement. The
// requirement is that a person can read the label, which is a ratio against
// the colour actually behind it, walked up the ancestor chain until an opaque
// background is found. A token compared against a surface it never sits on is
// Verification 33's wrong-axis shape.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk12/probe-g9-labels.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk12/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.G9_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const oppId = must(await db.from('records').select('id')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(1), 'opp')[0].id

// Computed IN the page, so the ratio is of what the browser painted.
const CENSUS = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  })
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  // THE SURFACE IS WALKED FOR, not assumed to be the page background. A label
  // inside a card sits on the card.
  const surfaceOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor)
      if (bg && bg.a > 0.99) return bg
      n = n.parentElement
    }
    return { r: 26, g: 27, b: 35, a: 1 }
  }
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  // Every element that is a FIELD LABEL or SECONDARY TEXT, by the classes the
  // estate uses for those roles. Enumerated by class because that is what a
  // token census is about; the count is reported so a zero cannot pass as a
  // clean result.
  const ROLES = {
    'field label (React rows)': '.deal-field > label, .deal-field label',
    'field label (terms cards)': '.terms-field-row label, .terms-field-row .pg-item-name',
    'field label (intake table)': '#deal-install-table th, .doc-table thead th',
    'pricing item name': '.pg-item-name',
    'pricing item note': '.pg-item-note',
    'section label': '.label',
    'field note': '.field-note',
    'card title': '.pg-card-title',
    'statement label': '.stmt-lbl',
    'statement sub': '.stmt-lbl small',
    'statement column head': '.stmt-colhead span',
  }
  const out = {}
  for (const [role, sel] of Object.entries(ROLES)) {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.textContent.trim())
    const byColour = {}
    for (const e of els) {
      const cs = getComputedStyle(e)
      const fg = parse(cs.color)
      if (!fg) continue
      const surf = surfaceOf(e)
      const eff = over(fg, surf)
      const k = `${cs.color} on ${hex(surf)}`
      byColour[k] = byColour[k] ?? {
        raw: cs.color, surface: hex(surf), effective: hex(eff),
        ratio: Number(ratio(eff, surf).toFixed(2)), n: 0, sample: e.textContent.trim().slice(0, 30),
      }
      byColour[k].n += 1
    }
    out[role] = { found: els.length, colours: Object.values(byColour) }
  }

  // THE TWO LABELS THE FINDING NAMES, with the chain that decides each.
  const named = {}
  for (const [name, text] of [['Contract duration', 'Contract duration'], ['SafeSight existing', 'SafeSight, existing']]) {
    const el = [...document.querySelectorAll('label, .pg-item-name, .deal-field')]
      .find((e) => e.textContent.trim().startsWith(text))
    if (!el) { named[name] = { missing: true }; continue }
    const cs = getComputedStyle(el)
    const surf = surfaceOf(el)
    const eff = over(parse(cs.color), surf)
    const chain = []
    let n = el
    for (let i = 0; i < 5 && n; i++) { chain.push(`${n.tagName.toLowerCase()}.${(n.className || '').toString().trim().split(/\s+/).join('.')}`); n = n.parentElement }
    named[name] = {
      colour: cs.color, surface: hex(surf), effective: hex(eff),
      ratio: Number(ratio(eff, surf).toFixed(2)), chain,
    }
  }
  return { out, named }
}

const b = await puppeteer.launch({ headless: 'new' })
const report = {}
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => !!document.querySelector('.terms-cards'), { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    const r = await p.evaluate(CENSUS)
    report[width] = r
    // ── THE ASSERTIONS G9 ASKS FOR ────────────────────────────────────
    //
    // A census that only prints is a reading. These are the claims.
    const roles = Object.entries(r.out).filter(([, v]) => v.found > 0)
    check(roles.length >= 8,
      `the census found label and secondary roles to measure at ${width}`,
      `${roles.length} roles with elements`)
    const under = roles.flatMap(([role, v]) =>
      v.colours.filter((c) => c.ratio < 4.5).map((c) => `${role} ${c.effective} ${c.ratio}`))
    check(under.length === 0,
      `every label and secondary colour clears 4.5:1 at ${width}`,
      under.length ? under.join('; ') : `${roles.length} roles, all clear`)
    const a = r.named['Contract duration'], bb = r.named['SafeSight existing']
    // BOTH SIDES MUST EXIST BEFORE THEY ARE COMPARED (Verification 14): two
    // missing labels comparing equal is what a broken selector reports.
    check(!a?.missing && !bb?.missing,
      `both named labels were found at ${width}`,
      `${a?.effective ?? 'MISSING'} / ${bb?.effective ?? 'MISSING'}`)
    check(a?.effective === bb?.effective,
      `the two named labels compute the SAME colour at ${width}`,
      `${a?.effective} vs ${bb?.effective}`)
    console.log(`\n══════ ${width} ══════`)
    for (const [role, v] of Object.entries(r.out)) {
      if (!v.found) { console.log(`  ${role.padEnd(28)} (none on this screen)`); continue }
      console.log(`  ${role.padEnd(28)} ${String(v.found).padStart(3)} element(s)`)
      for (const c of v.colours) {
        const flag = c.ratio < 4.5 ? '  << under 4.5:1' : ''
        console.log(`      ${String(c.n).padStart(3)}x  ${c.effective} on ${c.surface}   ratio ${String(c.ratio).padStart(5)}${flag}   e.g. "${c.sample}"`)
      }
    }
    console.log('  ── the two the finding names ──')
    for (const [k, v] of Object.entries(r.named)) {
      if (v.missing) { console.log(`     ${k}: NOT FOUND on this screen`); continue }
      console.log(`     ${k.padEnd(20)} ${v.effective} on ${v.surface}  ratio ${v.ratio}`)
      console.log(`     ${''.padEnd(20)} ${v.chain.slice(0, 3).join(' < ')}`)
    }
  }
} finally { await b.close() }
writeFileSync(`${OUT}g9-${TAG}.json`, JSON.stringify(report, null, 2))
console.log(`\nwritten to ${OUT}g9-${TAG}.json`)
const bad = checks.filter((c) => !c).length
console.log(`${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
