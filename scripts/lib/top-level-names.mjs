/**
 * EVERY TOP-LEVEL NAME IN A CLASSIC SCRIPT, BY EVERY DECLARATION FORM.
 *
 * Round 7 Phase 0. Split out of surface-accounting.test.mjs so one parser
 * serves every surface and each surface carries only its own capability map -
 * which is the shape Round 6's close-out predicted the retirement would need.
 *
 * ── WHY THE FORM LIST KEEPS GROWING, AND IT IS THE SAME LESSON EACH TIME ──
 *
 * Round 6's Phase 0 inventory anchored on `function`/`var`/`const`/`let` at
 * line start and reported 61 names on contact-detail.js where there were 76:
 * fifteen `window.X = function` declarations were invisible, and among them the
 * unqualify, delete and account-modal entry points.
 *
 * The instrument built to fix that STILL MISSED ONE on the very next surface.
 * `window.toggleExitCriterion = (field, isMet) => {` is an arrow, not a
 * `function`, so a matcher anchored on the keyword walked past it - and app.js
 * carries THIRTEEN more of the same form, which means the shell inventory
 * recorded at Round 6's close is undercounted by thirteen.
 *
 * So the window branch no longer asks WHAT is being assigned. Any
 * `window.X = ...` at line start is a global, whatever follows the equals.
 * Verification 50: enumerate by parsing declarations, not by matching one
 * shape of them.
 */

/**
 * @param {string} source the file's text
 * @returns {Array<{name: string, form: string, line: number}>}
 */
export function topLevelNames(source) {
  const out = []
  for (const [i, line] of source.split('\n').entries()) {
    let m = line.match(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/)
    if (m) { out.push({ name: m[1], form: 'function', line: i + 1 }); continue }
    // ANY assignment to window, whatever is on the right of the equals.
    m = line.match(/^window\.([A-Za-z0-9_$]+)\s*=/)
    if (m) { out.push({ name: m[1], form: 'window', line: i + 1 }); continue }
    m = line.match(/^(const|let|var)\s+([A-Za-z0-9_$]+)/)
    if (m) out.push({ name: m[2], form: m[1], line: i + 1 })
  }
  return out
}

/**
 * The split that decides what a bundle can reach, from Migration Round 2.
 *
 * `function` and `var` become properties of `window` because a classic script's
 * top-level declarations are globals - reachable today, and a deprecation that
 * comes due the day the shell becomes a module. `let` and `const` are LEXICAL
 * and were never reachable from a bundle at all: not a coupling to carry over,
 * a coupling that was never possible.
 */
export function reachability(names) {
  const reachable = names.filter((n) => n.form === 'function' || n.form === 'var' || n.form === 'window')
  const lexical = names.filter((n) => n.form === 'let' || n.form === 'const')
  return { reachable, lexical }
}
