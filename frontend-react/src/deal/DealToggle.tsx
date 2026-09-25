/* ── F1: ONE TOGGLE COMPONENT, WORN TWICE ─────────────────────────────────
   John's walk, 2026-09-25: "the OPEX/CAPEX control IS the PO Factoring toggle:
   same component, same dress, same size."

   It was three things before this: two buttons that happened to share a class
   string, a second class that changed one of their sizes, and two copies of the
   same `role`/`aria-checked`/`title` wiring. A shared class is not a shared
   component - it is the same markup written twice, which is Verification 20's
   two readers arriving in JSX.

   THE COMPONENT DECLARES `data-deal-toggle`, and that is what the tests
   enumerate by. A class can be copied onto any button by anybody; an attribute
   only this function writes cannot (Verification 19: enumerate by a declared
   property, never by a name).

   WHAT THIS SUPERSEDES, LEFT VISIBLE RATHER THAN DELETED. L1 made the mode
   control a LABELLED SLIDER: `OPEX` and `CAPEX` as separate spans either side
   of a bare 42px track, the active side taking the estate green, and the
   SLIDER DIRECTION FIX round then ruled that the knob sits on the side of the
   active mode with a 22px travel to make that readable.

   Both of those are gone here, and the reasoning that produced them was sound
   for the control they described. F1 supersedes the control itself: the
   flanking labels are precisely what made the two toggles different sizes, so
   "same size" cannot be satisfied while they exist. With one label inside the
   button there are no longer two sides for a knob to be nearer to, so the
   direction rule does not become false - it stops having a subject. */
export function DealToggle({ id, testid, on, label, title, ariaLabel, onClick }: {
  id: string
  testid: string
  on: boolean
  /** The state, named in the button, which is how the factoring toggle reads. */
  label: string
  /** What a click will do. A toggle showing only a state leaves the reader
      guessing which way it goes. */
  title: string
  ariaLabel?: string
  onClick(): void
}) {
  return (
    <button type="button" id={id} data-testid={testid} data-deal-toggle="true"
      className={`btn-ghost deal-toggle${on ? ' is-on' : ''}`}
      role="switch" aria-checked={on ? 'true' : 'false'} title={title}
      aria-label={ariaLabel} onClick={onClick}>{label}</button>
  )
}
