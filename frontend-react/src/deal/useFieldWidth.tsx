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
 * The same rule as a component, for the generated grids.
 *
 * A HOOK CANNOT BE CALLED IN A LOOP, and the milestone, contractor and OPEX
 * grids render their inputs by mapping over rows. Wrapping one input in one
 * component is the ordinary way out: each instance calls the hook once, which
 * is what the rules of hooks require and what a `.map()` body cannot do.
 */
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
