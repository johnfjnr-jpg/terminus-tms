// ── THE STRUCTURAL OVERPRINT DETECTOR, SHARED. TERM_PRICING_2, A3 ruling R1 ──
//
// The adjacency guard's W2 (`scripts/adjacency/probe-gaps.mjs`) compares six
// NAMED parts on one NAMED screen. It missed the Term Pricing Settings
// overprint (a screen it never opens) and the OPEX card overprint (two parts
// it never lists). Verification 19's second clause: a guard enumerating by
// name fails silently on the unrecorded instance.
//
// So this detector names nothing. Inside a root it collects every INK ATOM:
//   - each client rect of every visible, non-blank text node;
//   - the box of every visible input, select, textarea and button.
// An overprint is two atoms intersecting by more than 1px on BOTH axes, where
// neither atom's NODE contains the other's. The containment test is on the
// node, not the parent element: a label's own text and the input inside that
// label are compared, because an input printed over its own label is the
// plainest overprint there is, and a parent-element test would excuse it.
//
// AND A SECOND STRUCTURAL CLAIM, because A1 states two: "no grid track may
// shrink below its content". `shrunkBelowContent` checks every visible child
// of a grid or flex container against its own min-content width.
//
// WHAT IT CANNOT SEE, stated so nobody reads its silence as more than it is:
// a background or a border painted over text (no atom is a painted region),
// an element covering another with no text or control where they meet, and
// (in `shrunkBelowContent`) a form control narrower than its typed value.
//
// Both functions are evaluated in the PAGE, so each is self-contained: no
// closure, no import. Pass them to `page.evaluate(fn, rootSelector)`.

/** Every pair of ink atoms under `rootSel` that overprint each other. */
export function inkOverlaps(rootSel) {
  const root = document.querySelector(rootSel)
  if (!root) return { atoms: 0, hits: [], missing: true }
  const vis = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const atoms = []
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.nodeValue.trim() || !vis(n.parentElement)) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    for (const r of rg.getClientRects()) {
      if (r.width > 0 && r.height > 0) atoms.push({ node: n, r, t: JSON.stringify(n.nodeValue.trim().slice(0, 28)) })
    }
  }
  for (const e of root.querySelectorAll('input, select, textarea, button')) {
    if (!vis(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) atoms.push({ node: e, r, t: `<${e.tagName.toLowerCase()} ${e.dataset.testid ?? e.id ?? ''}>` })
  }
  const hits = []
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const a = atoms[i], b = atoms[j]
    if (a.node === b.node || a.node.contains(b.node) || b.node.contains(a.node)) continue
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
    if (ox > 1 && oy > 1) hits.push(`${a.t} x ${b.t} ${Math.round(ox)}x${Math.round(oy)}px`)
  }
  return { atoms: atoms.length, hits, missing: false }
}

/** Every visible grid or flex child under `rootSel` whose box, or whose grid track, is narrower than its own min-content. */
export function shrunkBelowContent(rootSel) {
  const root = document.querySelector(rootSel)
  if (!root) return { items: 0, hits: [], missing: true }
  const vis = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const out = []
  let items = 0
  for (const parent of [root, ...root.querySelectorAll('*')]) {
    if (!vis(parent)) continue
    const d = getComputedStyle(parent).display
    if (!/(^|-)(grid|flex)$/.test(d)) continue
    for (const e of parent.children) {
      if (!vis(e)) continue
      const cs = getComputedStyle(e)
      if (cs.position === 'absolute' || cs.position === 'fixed') continue
      // A FORM CONTROL'S min-content IS ITS DEFAULT INTRINSIC SIZE, NOT ITS
      // VALUE. Measured: an empty-looking units input "needs 183px" (size=20)
      // at every width, which is the instrument, not the screen. Controls are
      // left to the ink check (their box) and to the placeholder-fit rule.
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) continue
      items++
      const now = e.getBoundingClientRect().width
      // Measured, then restored in the same task, so nothing ever paints the probe width.
      const before = e.style.width, beforeMin = e.style.minWidth, beforeMax = e.style.maxWidth
      e.style.minWidth = '0'; e.style.maxWidth = 'none'; e.style.width = 'min-content'
      const min = e.getBoundingClientRect().width
      e.style.width = before; e.style.minWidth = beforeMin; e.style.maxWidth = beforeMax
      const name = (e.dataset?.testid || e.id || String(e.className) || e.tagName).slice(0, 40)
      if (now < min - 1) {
        out.push(`${name}: ${Math.round(now)}px, content needs ${Math.round(min)}px`)
        continue
      }
      // THE TRACK, NOT ONLY THE BOX. Found by the first red run: a TABLE's box
      // cannot shrink below its content, so in a `minmax(0, 1fr)` track it
      // keeps its width and OVERFLOWS the track instead. The box check above
      // passed it while it printed into the next column. A grid item's area
      // is measured by laying it out as a plain block at 100%, which resolves
      // against the grid area itself.
      if (/grid$/.test(d)) {
        const bd = e.style.display, bw = e.style.width, bmin = e.style.minWidth, bmax = e.style.maxWidth
        e.style.display = 'block'; e.style.width = '100%'; e.style.minWidth = '0'; e.style.maxWidth = 'none'
        const area = e.getBoundingClientRect().width
        e.style.display = bd; e.style.width = bw; e.style.minWidth = bmin; e.style.maxWidth = bmax
        if (area < min - 1) out.push(`${name}: its grid track is ${Math.round(area)}px, content needs ${Math.round(min)}px`)
      }
    }
  }
  return { items, hits: out, missing: false }
}
