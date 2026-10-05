import type React from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { formatFor, widthFor } from '../../../src/lib/field-formats.js'

/**
 * ── S1: AN INPUT SIZES ITSELF FROM ITS DECLARED FORMAT ───────────────────
 *
 * John's ruling: an input's width derives from its format string measured IN
 * THE INPUT'S OWN COMPUTED FONT, plus fixed padding.
 *
 * MEASURED AT RUNTIME, NOT COMPILED IN, and the reason is the word "own". A
 * width written into the stylesheet is a number that was right for the font
 * somebody had when they typed it: change the type scale, the family, or one
 * panel's size, and every literal becomes wrong silently. Measuring in the
 * element's own resolved font makes the width follow the type rather than
 * agree with it for a while, which is the per-site-literal problem the ruling
 * exists to end.
 *
 * ONE CANVAS, MODULE-SCOPE. `measureText` needs no DOM insertion and no
 * layout, so this costs no reflow; a hidden span would cost one per field.
 *
 * AND IT WAITS FOR THE FONTS. A measurement taken before Satoshi has loaded is
 * a measurement of the fallback, and every box would be sized for the wrong
 * face - silently, and differently on a warm cache. `document.fonts.ready`
 * resolves immediately once they are in, so the second pass is free.
 */
/* ASKED FOR ONCE, AND THE FAILURE IS CACHED TOO. jsdom does not implement
   `getContext`, and the first version asked on every measurement of every
   field: the React suite emitted a "Not implemented" line per call, hundreds of
   them, which flooded stderr and broke the pre-commit hook's parse of a suite
   that was passing. A null result is a RESULT and gets remembered like any
   other; `tried` is what distinguishes "no context" from "not asked yet". */
let ctx: CanvasRenderingContext2D | null = null
let tried = false
const measureIn = (font: string, s: string) => {
  if (!tried) {
    tried = true
    try { ctx = document.createElement('canvas').getContext('2d') } catch { ctx = null }
  }
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText(s).width
}

export function useFieldWidth(id: string | null | undefined) {
  const ref = useRef<HTMLInputElement | null>(null)

  const apply = useCallback(() => {
    const el = ref.current
    if (!el || !id) return
    const format = formatFor(id)
    // NOT A DEFAULT. A field the registry does not name keeps whatever width
    // the stylesheet gives it, and the estate-wide guard reports it by name.
    // Defaulting here would reintroduce the per-site literal one level down,
    // where nothing could see it.
    if (!format) return
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    el.style.width = `${widthFor(format, (s: string) => measureIn(font, s))}px`
  }, [id])

  useLayoutEffect(() => {
    apply()
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts?.ready) return
    let live = true
    fonts.ready.then(() => { if (live) apply() }).catch(() => {})
    return () => { live = false }
  }, [apply])

  return ref
}

/**
 * ── R-US4: A COLUMN IS SIZED TO ITS CONTENT, AND A HEADING WRAPS INSIDE IT ─
 *
 * John's ruling 2026-09-27, a permanent line in the S1 standard: a column is
 * sized to its CONTENT, figures per their S1 format, and a heading wider than
 * that WRAPS within the column rather than widening it.
 *
 * THE COLUMN THAT PROVED IT: "Rate (USD, from Base Cost Data)" held a 70px box
 * in a 228px column. A grid whose tracks are `auto` sizes every track to its
 * max-content, and a heading's max-content is the whole phrase on ONE LINE, so
 * the longest label in a column decided its width and the figures sat in a
 * column three times what they needed. Measured across the grid, that cost
 * 947px of content in an 876px panel at 1240.
 *
 * AND MAKING THE HEADING WRAP IS NOT ENOUGH, WHICH I MEASURED BEFORE BUILDING
 * THIS. Setting `white-space: normal` on the heads moved no track: `auto`
 * still resolves to max-content while the grid asks for max-content, so the
 * one-line width wins whatever the wrapping allows. The track has to be TOLD
 * the width; nothing about the heading can persuade it.
 *
 * THE WIDTH COMES FROM THE REGISTRY, measured in the grid's own resolved font,
 * for the same reason S1 measures an input that way: a number in the
 * stylesheet is right for the font somebody had when they typed it.
 *
 * THE FLOOR IS THE HEADING'S LONGEST WORD. A column narrower than one word
 * cannot wrap, it can only overflow, and an overflowing heading is the fault
 * this rule exists to end wearing different clothes. So a track is the wider of
 * its format and its longest head word, which still never takes the heading's
 * one-line width.
 */
export function useColumnWidths(formats: (string | null)[]) {
  const ref = useRef<HTMLDivElement | null>(null)
  const key = formats.join('|')

  const apply = useCallback(() => {
    const el = ref.current
    if (!el) return
    /* NO FORMATS MEANS NO TEMPLATE, AND THE CARD SIZES TO WHAT IT HOLDS. Under
       Lump Sum the Installation card's own columns are hidden and its content
       is the milestone grid, which SPANS them: fixed tracks from the registry
       would have sized the card to four empty columns and let the spanning
       grid overflow it by 24px. Measured, and the containment check said so. */
    if (!key) { el.style.removeProperty('grid-template-columns'); return }
    const heads = [...el.querySelectorAll<HTMLElement>('.ig-head')]
    const cs = getComputedStyle(el)
    const bodyFont = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const tracks = key.split('|').map((format, i) => {
      // A text column keeps `auto`: it holds words, not figures, and the
      // registry has nothing to say about it.
      if (!format) return 'auto'
      const figure = widthFor(format, (s: string) => measureIn(bodyFont, s))
      const head = heads[i]
      let word = 0
      if (head) {
        const hcs = getComputedStyle(head)
        const headFont = `${hcs.fontStyle} ${hcs.fontWeight} ${hcs.fontSize} ${hcs.fontFamily}`
        /* ── THE TRACKING IS PART OF THE WORD. LABEL_CONTRAST, 2026-10-05 ──
           A canvas measures glyphs and ignores `letter-spacing`, and the heads
           carry 0.1em of it, which the browser adds after every character. So
           "UNITS" measured 36px and painted 42px at 12px (31.5 against 37 at
           the old 10.5px), and the column was narrower than its own heading:
           the shared shrink check flagged it, and raising the label token made
           it push the Installation panel 6px past its section at 1240. */
        const tracking = parseFloat(hcs.letterSpacing) || 0
        for (const w of (head.textContent ?? '').split(/\s+/)) {
          word = Math.max(word, measureIn(headFont, w) + tracking * [...w].length)
        }
      }
      return `${Math.ceil(Math.max(figure, word))}px`
    })
    el.style.gridTemplateColumns = tracks.join(' ')
  }, [key])

  useLayoutEffect(() => {
    apply()
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts?.ready) return
    let live = true
    fonts.ready.then(() => { if (live) apply() }).catch(() => {})
    return () => { live = false }
  }, [apply])

  return ref
}

/**
 * The same rule as a component, for the generated grids.
 *
 * A HOOK CANNOT BE CALLED IN A LOOP, and the milestone, contractor and OPEX
 * grids render their inputs by mapping over rows. Wrapping one input in one
 * component is the ordinary way out: each instance calls the hook once, which
 * is what the rules of hooks require and what a `.map()` body cannot do.
 */
/**
 * ── P2: TWO GRIDS THAT MUST AGREE ON A TRACK. John's walk 2026-09-27 ──────
 *
 * `.cm-grid-head` and `.cm-grid-row` are SEPARATE grid elements sharing one
 * template, which is how the header sits over the field it names. R-US4 made
 * the amount column `max-content`, correctly, and **`max-content` resolves per
 * grid**: the head's is the word "Amount" and the row's is a 70px input.
 * Measured at 1920, the head's track was 36px and the row's input 70px, so the
 * header covered the left half of its own column. The `%` header had the
 * mirror of it - right-aligned into a 44px literal while its input was 30px,
 * so the glyph sat 8px past the input's right edge, which is the crowding
 * John reported.
 *
 * So the width is measured ONCE and published as a custom property both grids
 * read. It is not a second reader of the registry: it reads the width S1 has
 * already applied to the control, so the track is the control's own width by
 * construction and cannot drift from it.
 *
 * CHILD EFFECTS RUN FIRST, which is what makes this safe: every `SizedInput`
 * inside has applied its inline width before this parent effect measures. And
 * the inline width beats `.cm-grid-row input { width: 100% }`, so setting the
 * track to the input's width converges rather than oscillating.
 */
export function useTrackWidths(vars: Array<[string, number]>) {
  const ref = useRef<HTMLDivElement | null>(null)
  const key = JSON.stringify(vars)

  const apply = useCallback(() => {
    const el = ref.current
    if (!el) return
    const row = el.querySelector('.cm-grid-row, .ms-grid-row')
    if (!row) return
    const kids = [...row.children]
    for (const [name, i] of JSON.parse(key) as Array<[string, number]>) {
      const k = kids[i] as HTMLElement | undefined
      if (!k) continue
      const c = (k.matches('input, select') ? k : k.querySelector('input, select')) as HTMLElement | null
      if (!c) continue
      const w = Math.ceil(c.getBoundingClientRect().width)
      if (w > 0) el.style.setProperty(name, `${w}px`)
    }
  }, [key])

  useLayoutEffect(() => {
    apply()
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts?.ready) return
    let live = true
    fonts.ready.then(() => { if (live) apply() }).catch(() => {})
    return () => { live = false }
  })

  return ref
}

export function SizedInput({ id, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { id?: string }) {
  /* THE REGISTRY KEY IS THE `id`, OR THE TEST ID WHERE THERE IS NO `id`.
     The OPEX table's unit boxes carry only a `data-testid`, because their
     `id` would collide with the Units card's own inputs and the estate has a
     no-duplicate-ids guard. Falling back to the test id keeps one registry key
     per control without minting a duplicate id to satisfy this hook. */
  const key = id ?? (rest as Record<string, string>)['data-testid']
  const ref = useFieldWidth(key)
  return <input ref={ref} {...(id ? { id } : {})} {...rest} />
}
