// ── THE LATCH, AS BEHAVIOUR ──────────────────────────────────────────────
//
// Session hiding of input sections. Enumerated from applyLatches
// (opportunity-deal.js:782) and its click wiring (:1899) before being built.
//
// SESSION ONLY. Nothing about a latch reaches the payload, so a latched
// section must not make the form dirty and a reload brings everything back.
// There is no remembered set to return to, which is why "show all" returns to
// EVERYTHING visible rather than to whatever was showing before.
//
// The signal and its sentence come from src/lib/latches.js, the same module the
// vanilla calls, so the two surfaces cannot drift about what a hidden section
// is worth warning about.
import { LATCH_PANELS, panelSignal, signalSentence } from '../../../src/lib/latches.js'

export interface LatchPanel { id: string, label: string }
export const PANELS = LATCH_PANELS as readonly LatchPanel[]

export interface LatchInputs {
  marginOverrides: Record<string, string | undefined>
  rateValues: Record<string, string | undefined>
  catalogProblem: boolean
}

export interface LatchView {
  latched: boolean
  buttonText: 'Show' | 'Hide'
  ariaExpanded: 'true' | 'false'
  signalled: boolean
  title: string
}

export function latchView(
  panel: LatchPanel, latched: ReadonlySet<string>,
  payload: Record<string, unknown>, inputs: LatchInputs,
): LatchView {
  const off = latched.has(panel.id)
  // The signal is only computed for a HIDDEN panel: a visible one needs no
  // warning, because the thing it would warn about is on the screen.
  const signal = off ? panelSignal(panel, payload, inputs) as { signalled: boolean } : null
  return {
    latched: off,
    buttonText: off ? 'Show' : 'Hide',
    ariaExpanded: off ? 'false' : 'true',
    signalled: !!signal?.signalled,
    title: signal ? signalSentence(signal, panel) as string : `Hide ${panel.label}`,
  }
}

export function latchAllView(
  latched: ReadonlySet<string>, payload: Record<string, unknown>, inputs: LatchInputs,
): { text: 'Show all' | 'Hide all', signalled: boolean } {
  const anyHidden = latched.size > 0
  return {
    text: anyHidden ? 'Show all' : 'Hide all',
    signalled: anyHidden && PANELS.some((p) => latched.has(p.id)
      && (panelSignal(p, payload, inputs) as { signalled: boolean }).signalled),
  }
}

/** Anything latched clears everything; nothing latched latches everything. */
export function toggleAll(latched: ReadonlySet<string>): Set<string> {
  return latched.size > 0 ? new Set() : new Set(PANELS.map((p) => p.id))
}

export function toggleOne(latched: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(latched)
  if (next.has(id)) next.delete(id); else next.add(id)
  return next
}
