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
/* ── AND THE VARIANT, John's ruling 2026-09-26 ────────────────────────────
   The paragraph above is left standing because its reasoning was sound and is
   now only half the story. F1 removed the flanking labels because they were
   what made the two controls different sizes. True, and no longer decisive:

     A TWO-STATE SELECTOR names both of its states, either side of the track,
     and the knob travels toward the one in force.
     AN ON/OFF SWITCH names the one state it is in, inside the button.

   Those are different questions, and every previous round treated them as one
   control. `flank` is which question this instance is asking.

   THE KNOB NEEDS NO CSS INVERSION and that is a consequence of the ruling
   rather than a coincidence. `.deal-toggle` travels RIGHT when `is-on`, and
   both selectors here put the `on` state on the RIGHT: OPEX right of CAPEX,
   Declining balance right of Straight-line. The slider-direction round had to
   invert the travel because L1 had put the `on` label on the LEFT. Caller
   contract: `on` is the RIGHT-HAND label. */
export function DealToggle({ id, testid, on, label, title, ariaLabel, onClick, flank }: {
  id: string
  testid: string
  on: boolean
  /** The state, named in the button. ON/OFF switches only; omitted when `flank`
      names both states outside. */
  label?: string
  /** What a click will do. A toggle showing only a state leaves the reader
      guessing which way it goes. */
  title: string
  ariaLabel?: string
  onClick(): void
  /** A two-state selector: both states named, `on` being the RIGHT one. The
      labels carry `data-active` and the STYLESHEET colours them, so the
      marking is one fact with one writer. */
  flank?: { left: string, right: string, testidLeft: string, testidRight: string }
}) {
  const button = (
    <button type="button" id={id} data-testid={testid} data-deal-toggle="true"
      className={`btn-ghost deal-toggle${flank ? ' deal-toggle--flanked' : ''}${on ? ' is-on' : ''}`}
      role="switch" aria-checked={on ? 'true' : 'false'} title={title}
      aria-label={ariaLabel ?? (flank ? `${flank.left} or ${flank.right}, currently ${on ? flank.right : flank.left}` : undefined)}
      onClick={onClick}>{flank ? null : label}</button>
  )
  if (!flank) return button
  return (
    <span className="deal-toggle-pair">
      <span className="deal-toggle-side" data-testid={flank.testidLeft}
        data-active={on ? 'false' : 'true'}>{flank.left}</span>
      {button}
      <span className="deal-toggle-side" data-testid={flank.testidRight}
        data-active={on ? 'true' : 'false'}>{flank.right}</span>
    </span>
  )
}
