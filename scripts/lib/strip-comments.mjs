// Comment stripping for any guard or probe that scans source code for evidence.
// CLAUDE.md Verification 39. Round 41.
//
// THE FAULT THIS EXISTS TO PREVENT: prose satisfying a check meant for code. A
// scan greps a source file for an identifier, a comment mentions that
// identifier, and the scan reports the code present when only the sentence is.
// It fired three times in Round 41 alone, in three instruments written
// independently, which is why this is a shared module rather than a habit.
//
// COMMENTS BECOME SPACES, NOT NOTHING. Every stripped character is replaced by
// a space and every newline is kept, so offsets and line numbers in the
// stripped text are the offsets and line numbers in the file. An instrument
// that reports `file:line` keeps reporting the right line.
//
// THE HAZARD IS THE OPPOSITE MISTAKE, and it is why the calibration in
// scripts/tests/strip-comments.test.mjs is half the value here: a stripper that
// eats real code turns a passing scan into a silent false negative, which is
// the fault it was built to catch wearing the other hat. `'https://x'` is not a
// comment. `/[^/]*/` is not a comment. A `/*` inside a template literal is not
// a comment.

import { readFileSync } from 'node:fs'

const OPENS_REGEX_BEFORE = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*',
  '%', '~', '^', '<', '>',
])

const KEYWORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do',
  'else', 'yield', 'await', 'case', 'throw',
])

// A `/` is a regex opener or a division sign, and nothing local tells them
// apart: the decision needs the previous significant TOKEN. Cheapest correct
// rule, and the one every hand-written JS lexer uses.
//
// Tracked forward as characters are emitted rather than by scanning backwards
// through the output, because a backward scan is re-run at every `/` and this
// module is pointed at a 170KB stylesheet and a 160KB page.
// A newline is NOT a reset. `a\n/ b` is division, and a statement that opens
// with a regex literal does not occur. Both wrong answers are expensive: read
// a regex as division and `//` inside it strips the rest of the line; read
// division as a regex and everything to the next `/` is eaten.
function tracker() {
  let sig = ''        // last significant character of emitted CODE, '' at start
  let word = ''       // identifier ending at that character, if any
  return {
    feed(s) {
      for (const c of s) {
        if (/\s/.test(c)) continue
        sig = c
        word = /[A-Za-z0-9_$]/.test(c) ? word + c : ''
      }
    },
    regexAllowed() {
      if (sig === '') return true
      if (/[A-Za-z0-9_$]/.test(sig)) return KEYWORDS_BEFORE_REGEX.has(word)
      return OPENS_REGEX_BEFORE.has(sig)
    },
  }
}

function blank(s) {
  // Newlines survive so line numbers do; everything else becomes a space.
  let o = ''
  for (const c of s) o += c === '\n' ? '\n' : ' '
  return o
}

// Strips JavaScript comments. Strings, template literals (including nested
// `${}`) and regex literals (including `/` inside a character class) are code.
export function stripJs(src) {
  const out = []
  const t = tracker()
  const stack = []            // template-literal nesting: '`' or '{'
  let i = 0
  const n = src.length
  const code = (s) => { out.push(s); t.feed(s) }
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    // TEMPLATE TEXT is checked FIRST, and it has to be, because the resumption
    // after a `${...}` window closes lands back here rather than at the opening
    // backtick. Handling it inside the backtick branch alone left the text
    // after the first interpolation being read as code, so `//` in a template
    // would have been stripped.
    if (stack[stack.length - 1] === '`') {
      if (c === '\\') { code(src.slice(i, i + 2)); i += 2; continue }
      if (c === '`') { stack.pop(); code(c); i++; continue }
      if (c === '$' && d === '{') { stack.push('{'); code('${'); i += 2; continue }
      code(c); i++
      continue
    }
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      out.push(blank(src.slice(i, j)))    // blanked, so it feeds the tracker nothing
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j === -1 ? n : j + 2
      out.push(blank(src.slice(i, j)))
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === c || src[j] === '\n') { j++; break }
        j++
      }
      code(src.slice(i, j))
      i = j
      continue
    }
    if (c === '`') {
      // A template literal is code until its closing backtick, and `${` opens a
      // window where code resumes. Tracked on a stack because the window can
      // contain another template literal.
      stack.push('`')
      code(c); i++
      continue
    }
    if (c === '}' && stack[stack.length - 1] === '{') {
      stack.pop()
      code(c); i++
      continue
    }
    if (c === '/' && t.regexAllowed()) {
      let j = i + 1
      let inClass = false
      let closed = false
      while (j < n) {
        const e = src[j]
        if (e === '\\') { j += 2; continue }
        if (e === '\n') break
        if (e === '[') inClass = true
        else if (e === ']') inClass = false
        else if (e === '/' && !inClass) { j++; closed = true; break }
        j++
      }
      if (closed) {
        while (j < n && /[dgimsuvy]/.test(src[j])) j++
        code(src.slice(i, j))
        i = j
        continue
      }
    }
    code(c)
    i++
  }
  return out.join('')
}

// Strips CSS comments. Only `/* */`, and strings are code.
export function stripCss(src) {
  let o = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j === -1 ? n : j + 2
      o += blank(src.slice(i, j))
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === c || src[j] === '\n') { j++; break }
        j++
      }
      o += src.slice(i, j)
      i = j
      continue
    }
    o += c
    i++
  }
  return o
}

// Strips HTML comments, AND the comments inside inline <script> and <style>,
// because a scan of index.html for a JavaScript identifier is scanning
// JavaScript. An external <script src> has no content to strip.
export function stripHtml(src) {
  let o = ''
  let i = 0
  const n = src.length
  while (i < n) {
    if (src.startsWith('<!--', i)) {
      let j = src.indexOf('-->', i + 4)
      j = j === -1 ? n : j + 3
      o += blank(src.slice(i, j))
      i = j
      continue
    }
    const m = /^<(script|style)\b[^>]*>/i.exec(src.slice(i, i + 400))
    if (m) {
      const tag = m[1].toLowerCase()
      const openEnd = i + m[0].length
      const close = src.toLowerCase().indexOf(`</${tag}`, openEnd)
      const end = close === -1 ? n : close
      o += m[0]
      const body = src.slice(openEnd, end)
      o += tag === 'script' ? stripJs(body) : stripCss(body)
      i = end
      continue
    }
    o += src[i]
    i++
  }
  return o
}

// Strips SQL comments: `--` to end of line and `/* */`, which Postgres nests.
// DOLLAR QUOTING is the reason this cannot be the CSS stripper with one extra
// case: a plpgsql body between `$$` or `$tag$` is a string, and every migration
// here that defines a function contains one.
export function stripSql(src) {
  let o = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '-' && src[i + 1] === '-') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      o += blank(src.slice(i, j))
      i = j
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      let depth = 1
      let j = i + 2
      while (j < n && depth > 0) {
        if (src[j] === '/' && src[j + 1] === '*') { depth++; j += 2; continue }
        if (src[j] === '*' && src[j + 1] === '/') { depth--; j += 2; continue }
        j++
      }
      o += blank(src.slice(i, j))
      i = j
      continue
    }
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (src[j] === "'" && src[j + 1] === "'") { j += 2; continue }
        if (src[j] === "'") { j++; break }
        j++
      }
      o += src.slice(i, j)
      i = j
      continue
    }
    const dq = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(src.slice(i, i + 64))
    if (dq) {
      const tag = dq[0]
      const close = src.indexOf(tag, i + tag.length)
      const end = close === -1 ? n : close + tag.length
      o += src.slice(i, end)
      i = end
      continue
    }
    o += c
    i++
  }
  return o
}

// Strips shell comments. `#` opens one only outside quotes and only where a
// word does not already carry it, so `$#`, `${x#y}` and a `#` inside '...' or
// "..." are code.
export function stripSh(src) {
  let o = ''
  let i = 0
  const n = src.length
  let prev = '\n'
  while (i < n) {
    const c = src[i]
    if (c === '#' && /[\s;&|(]/.test(prev)) {
      let j = i
      while (j < n && src[j] !== '\n') j++
      o += blank(src.slice(i, j))
      i = j
      prev = '\n'
      continue
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      while (j < n) {
        if (c === '"' && src[j] === '\\') { j += 2; continue }
        if (src[j] === c) { j++; break }
        j++
      }
      o += src.slice(i, j)
      prev = src[j - 1] ?? c
      i = j
      continue
    }
    o += c
    prev = c
    i++
  }
  return o
}

export function stripComments(src, kind) {
  if (kind === 'js') return stripJs(src)
  if (kind === 'css') return stripCss(src)
  if (kind === 'html') return stripHtml(src)
  if (kind === 'sql') return stripSql(src)
  if (kind === 'sh') return stripSh(src)
  throw new Error(`stripComments: unknown kind ${kind}`)
}

export function kindOf(path) {
  const p = String(path)
  // ── TS AND TSX READ AS JS, AND THAT IS A CLAIM, NOT A CONVENIENCE ──────
  //
  // Migration Round 1 Phase 2. The stripper had no kind for the file types the
  // migration introduces, so every Verification 39 scan was UNABLE TO READ the
  // React tree - it threw rather than returning a wrong answer, which is the
  // good failure, but it meant an evidence scan over frontend-react/src could
  // not be written at all.
  //
  // WHAT MAKES js CORRECT FOR THEM: stripJs's job is to remove `//` and `/* */`
  // while preserving strings, template literals and regex literals. TypeScript
  // adds no comment syntax and no new literal syntax that changes where a
  // comment can start. JSX is the one thing worth naming, and it is safe for a
  // sharp reason: `{/* ... */}` inside JSX is a JS comment inside a JS
  // expression container, which is exactly what stripJs already handles. What
  // JSX does NOT have is HTML comments; `<!-- -->` is a syntax error in JSX,
  // so there is nothing html-shaped to miss.
  //
  // Calibrated in both directions in scripts/tests/strip-comments.test.mjs:
  // a comment in a .tsx fails to satisfy a scan, and stripped .tsx source still
  // parses and keeps its real code.
  if (/\.(m?js|cjs|m?ts|tsx|jsx)$/.test(p)) return 'js'
  if (/\.css$/.test(p)) return 'css'
  if (/\.html?$/.test(p)) return 'html'
  if (/\.sql$/.test(p)) return 'sql'
  if (/\.(sh|bash)$/.test(p) || /(^|\/)[a-z-]+$/.test(p)) return 'sh'
  throw new Error(`stripComments: no kind for ${p}`)
}

// THE ONE-LINE ADOPTION PATH. An instrument scanning source for evidence reads
// through this instead of readFileSync, and gets the kind from the extension
// rather than choosing it. Anything reading a file for a reason OTHER than
// scanning code for evidence keeps readFileSync, and the exceptions are named
// where they occur: scripts/tests/no-secrets.test.mjs must NOT strip, because a
// secret committed inside a comment is still a committed secret.
export function readCode(path, kind) {
  const p = path instanceof URL ? path.pathname : String(path)
  return stripComments(readFileSync(p, 'utf8'), kind || kindOf(p))
}
