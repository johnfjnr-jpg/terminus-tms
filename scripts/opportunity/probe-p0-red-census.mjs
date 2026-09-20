// Q3: THE `--red` CENSUS, DERIVED FROM A SCAN AND NOT FROM A WORD LIST.
//
// The amber sweep's lesson, written into this instrument rather than into a
// habit: a word list counts what somebody NAMED red. A site called `danger`,
// `alert`, `err`, `overdue` or nothing at all still renders red. So the
// population is found by parsing colour LITERALS and classifying each by HUE.
//
// V12's author-side clause: a tool that cannot classify an input RAISES AND
// NAMES IT. Returning a shorter list is the failure, because a smaller count
// reads as progress.
//
// V39: comments are stripped before matching, or the prose above (which names
// #e06c6c twice) becomes three findings.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// ── THE BAND IS A REQUIREMENT, WRITTEN BEFORE ANY VALUE WAS MEASURED ─────
// "Red" here means a hue a person reads as red rather than orange or magenta,
// with enough saturation to carry a colour at all. Greys have no hue and are
// excluded by the saturation floor, not by a name.
const RED_HUE = (h) => h >= 340 || h <= 14
const SAT_FLOOR = 0.25
const LIGHT_BAND = (l) => l > 0.12 && l < 0.92

const toHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === r) h = 60 * (((g - b) / d) % 6)
  else if (max === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  return { h: (h + 360) % 360, s, l }
}

const parseColour = (tok) => {
  if (tok.startsWith('#') && !HEX_LENGTHS.has(tok.length - 1)) return null
  let m = /^#([0-9a-fA-F]{3})$/.exec(tok)
  if (m) { const [a, b, c] = m[1]; return toHsl(parseInt(a + a, 16), parseInt(b + b, 16), parseInt(c + c, 16)) }
  m = /^#([0-9a-fA-F]{6})$/.exec(tok)
  if (m) return toHsl(parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16))
  m = /^#([0-9a-fA-F]{8})$/.exec(tok)
  if (m) return toHsl(parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16))
  m = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/.exec(tok)
  if (m) return toHsl(+m[1], +m[2], +m[3])
  m = /^hsla?\(\s*([0-9.]+)/.exec(tok)
  if (m) return { h: +m[1] % 360, s: 1, l: 0.5, fromHsl: true }
  return null // the caller RAISES; this never silently drops
}

// AN HTML NUMERIC ENTITY IS NOT A COLOUR, and the first run proved it by
// REFUSING rather than by under-counting: `&#10003;` (a check mark) and
// `&#9650;` (a triangle) both matched a bare hex pattern, and `#9650` is even
// a valid four-digit #RGBA length, so length alone cannot separate them. The
// discrimination is the preceding `&`, which is what makes it an entity.
const COLOUR_TOKEN = /(?<!&)#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g
const HEX_LENGTHS = new Set([3, 4, 6, 8])

const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (['.css', '.js', '.ts', '.tsx', '.html'].includes(extname(p))) files.push(p)
  }
}
walk(join(ROOT, 'frontend'))
walk(join(ROOT, 'frontend-react/src'))

const findings = []
const unparseable = []
let scanned = 0, colours = 0
for (const f of files) {
  let code
  try { code = readCode(f) } catch { code = readFileSync(f, 'utf8') }
  scanned++
  for (const line of code.split('\n').map((l, i) => ({ l, n: i + 1 }))) {
    for (const tok of line.l.match(COLOUR_TOKEN) || []) {
      colours++
      const hsl = parseColour(tok)
      if (!hsl) { unparseable.push(`${f}:${line.n}  ${tok}`); continue }
      if (RED_HUE(hsl.h) && hsl.s >= SAT_FLOOR && LIGHT_BAND(hsl.l)) {
        findings.push({ file: f.replace(ROOT, ''), line: line.n, tok,
          h: hsl.h.toFixed(0), s: (hsl.s * 100).toFixed(0), l: (hsl.l * 100).toFixed(0) })
      }
    }
  }
}

if (unparseable.length) {
  console.error(`REFUSING TO REPORT A COUNT: ${unparseable.length} colour tokens could not be classified.`)
  for (const u of unparseable) console.error('  ' + u)
  process.exit(2)
}

console.log(`files scanned: ${scanned};  colour literals parsed: ${colours};  RED by hue: ${findings.length}`)
const byFile = {}
for (const f of findings) (byFile[f.file] ||= []).push(f)
console.log(`\nBY FILE`)
for (const [file, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${String(list.length).padStart(3)}  ${file}`)
console.log(`\nDISTINCT RED VALUES`)
const byVal = {}
for (const f of findings) (byVal[f.tok.toLowerCase()] ||= []).push(f)
for (const [v, list] of Object.entries(byVal).sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${String(list.length).padStart(3)}  ${v.padEnd(26)} hue ${list[0].h}  sat ${list[0].s}%  light ${list[0].l}%`)
