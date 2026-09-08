// A comment stripper that does not eat code. Verification 39's second half:
// "a stripper that eats real code turns every scan built on it into a silent
// false negative, which is worse, because the first version at least fails
// loudly when the code is missing."
//
// The regex version used in the first pass of this phase ate
// `const u = 'https://x//y'` at the //, taking the rest of the line with it.
// Caught by the calibration, which is the only thing that could have caught it.
//
// A character walk, tracking string, template and regex context. Comments are
// replaced by spaces so byte offsets and line counts survive.
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let ctx = 'code'          // code | sq | dq | tpl | regex | line | block
  let depth = 0             // template ${ } nesting
  const tplStack = []
  while (i < n) {
    const c = src[i], d = src[i + 1]
    if (ctx === 'code') {
      if (c === '/' && d === '/') { ctx = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && d === '*') { ctx = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { ctx = 'sq'; out += c; i++; continue }
      if (c === '"') { ctx = 'dq'; out += c; i++; continue }
      if (c === '`') { ctx = 'tpl'; out += c; i++; continue }
      if (c === '/' && isRegexStart(out)) { ctx = 'regex'; out += c; i++; continue }
      if (c === '}' && tplStack.length && depth === tplStack[tplStack.length - 1]) {
        tplStack.pop(); depth--; ctx = 'tpl'; out += c; i++; continue
      }
      if (c === '{') depth++
      if (c === '}') depth--
      out += c; i++; continue
    }
    if (ctx === 'line') { if (c === '\n') { ctx = 'code'; out += c } else out += ' '; i++; continue }
    if (ctx === 'block') {
      if (c === '*' && d === '/') { ctx = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '; i++; continue
    }
    if (ctx === 'sq' || ctx === 'dq' || ctx === 'regex') {
      if (c === '\\') { out += c + (d ?? ''); i += 2; continue }
      if ((ctx === 'sq' && c === "'") || (ctx === 'dq' && c === '"') || (ctx === 'regex' && c === '/')) ctx = 'code'
      if (ctx === 'regex' && c === '\n') ctx = 'code'   // an unterminated regex guess; fail open to code
      out += c; i++; continue
    }
    if (ctx === 'tpl') {
      if (c === '\\') { out += c + (d ?? ''); i += 2; continue }
      if (c === '`') { ctx = 'code'; out += c; i++; continue }
      if (c === '$' && d === '{') { depth++; tplStack.push(depth); ctx = 'code'; out += '${'; i += 2; continue }
      out += c; i++; continue
    }
  }
  return out
}

// A `/` starts a regex when the last significant character cannot end an
// expression. Deliberately conservative: when unsure, treat it as division,
// because guessing "regex" is what swallows real code.
function isRegexStart(before) {
  const m = before.replace(/\s+$/, '')
  if (!m) return true
  const last = m[m.length - 1]
  if (/[)\]}\w$]/.test(last)) {
    const kw = m.match(/\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/)
    return !!kw
  }
  return true
}
