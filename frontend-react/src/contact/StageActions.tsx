// ── THE STAGE ACTIONS ────────────────────────────────────────────────────
//
// ~~U1 TO U3, D1 TO D3.~~ The vanilla's renderCdActions drew Qualify, Park AND
// Move to Unqualified, and a Delete beneath them. The Phase 2 panel had only
// Qualify, so the capability was two thirds absent while reading as present -
// which is what the accounting instrument found and a screenshot showed as "a
// button is missing".
//
// ── R8, 2026-09-11: DELETE AND UNQUALIFY ARE REMOVED, AS A LIFECYCLE RULE ─
//
// Ruled by John at the P3 close, and recorded as a rule rather than a layout
// choice so a later round does not restore them on the grounds that the
// vanilla had them:
//
//   Leads are NOT deleted from the Lead screen at this stage.
//   The lead lifecycle is FORWARD-ONLY at this stage: created Unqualified,
//   then Qualified or Nurture. No transition back to Unqualified.
//
// The superseded reasoning is struck above rather than deleted. Restoring
// these because "the vanilla had them" would be re-deciding a question that
// has now been decided the other way (Verification 23).
//
// THE CONTROL GOING DOES NOT CLOSE THE TRANSITION, and that is flagged rather
// than fixed. Measured 2026-09-11 against the live server:
//
//     POST /records/:id/transition {to_stage:'Unqualified'} on a Qualified
//     lead -> 200 ACCEPTED, and the record moves.
//
// transitions.js permits any BACKWARD transition by design - `isBackward`
// exempts it from the adjacency check - and its own comment records that
// whether a reversal should need a reason or an entitlement is a live
// question. Closing it server-side is a separate item, flagged not built.
import { useEffect, useRef, useState } from 'react'

export function StageActions({ status, onQualify, onPark, onCreate, qualifyBlockedCount = 0 }: {
  status: string | null
  onQualify: () => void
  /** P3: how many gate requirements are still unmet. 0 enables Qualify. */
  qualifyBlockedCount?: number
  onPark: () => void
  onCreate: (kind: 'test-bed' | 'opportunity') => void
}) {
  const qualified = status === 'Qualified'
  const [menuOpen, setMenuOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement | null>(null)
  // A menu that only closes by choosing is a menu left open behind whatever
  // the person does next. Escape and a click outside both close it; the
  // listeners exist only while it is open, so there is one owner of each and
  // nothing to leak.
  useEffect(() => {
    if (!menuOpen) return
    const away = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [menuOpen])
  return (
    <div className="cd-actions" data-testid="cd-actions">
      {!qualified
        // THE TREATMENT THE VANILLA GAVE THEM. `frontend/index.html` has
        // `class="btn-primary"` on Qualify and `class="btn-ghost"` on Park;
        // the migration carried the controls and left the classes behind, so
        // both rendered as white browser defaults on a dark screen -
        // Verification 7's replacement clause, which this estate has already
        // shipped once.
        //
        // Fixed HERE rather than queued because R4 just gave the third control
        // in this same row its correct treatment. Rule 10's limit: a defect
        // made visible by making its neighbour correct is part of the change,
        // and a row of one styled and two unstyled controls is worse than the
        // uniform wrongness it replaced.
        ? <button type="button" className="btn-primary"
            id="cd-btn-qualify" data-testid="cd-btn-qualify"
            // P3: DISABLED UNTIL THE SERVER SAYS IT WOULD SUCCEED. The count
            // comes from GET /records/:id/exit-criteria - the enforcement's own
            // derivation - so the button cannot disagree with the gate.
            //
            // THE SERVER IS STILL THE ENFORCEMENT. This is presentation: it
            // stops a person making a request that will be refused, and says
            // why. Removing it would not let anybody qualify a lead that is
            // incomplete; the 422 is what does that.
            disabled={qualifyBlockedCount > 0}
            title={qualifyBlockedCount > 0
              ? `Qualify needs ${qualifyBlockedCount} more field${qualifyBlockedCount === 1 ? '' : 's'}`
              : undefined}
            onClick={onQualify}>Qualify</button>
        : null}
      {/* R3: NURTURE IS A LEAD ACTION. It was unconditional, so a contact -
          a record that has already left the lead pipeline - was offered a
          move back into it. Guarded by the SAME `qualified` this component
          already computes, so the lead view cannot be reached by the guard. */}
      {!qualified
        ? <button type="button" className="btn-ghost"
            id="cd-btn-park" data-testid="cd-btn-park"
            onClick={onPark}>Nurture</button>
        : null}
      {/* R8: no Unqualify. The lifecycle is forward-only at this stage. */}

      {/* D3: create is offered ONLY on a Qualified contact. */}
      {/* R4: ONE CONTROL, THEN THE SHELL'S OWN DIALOGUE.
          This was two bare buttons in `.cd-create-section`, a class with ZERO
          rules in the stylesheet - which is why they rendered as white browser
          defaults on a dark screen. The three classes here are the estate's
          declared treatment for exactly this control, the one the Contacts
          list's own "+ Create" already wears (Verification 7: a replacement
          inherits the replaced control's treatment).
          The testids are kept: `contact-capabilities` cites both items. */}
      {qualified
        ? <span className="cd-create-anchor" data-testid="cd-create-section" ref={anchor}>
            <button type="button" className="contact-create-trigger"
              data-testid="cd-create" id="cd-create"
              aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="cd-create-menu"
              onClick={() => setMenuOpen((o) => !o)}>+ Create</button>
            {menuOpen
              ? <div className="contact-create-dropdown" id="cd-create-menu" role="menu"
                  data-testid="cd-create-menu">
                  <button type="button" role="menuitem" className="contact-create-item"
                    data-testid="cd-create-test-bed"
                    onClick={() => { setMenuOpen(false); onCreate('test-bed') }}>Test Bed</button>
                  <button type="button" role="menuitem" className="contact-create-item"
                    data-testid="cd-create-opportunity"
                    onClick={() => { setMenuOpen(false); onCreate('opportunity') }}>Opportunity</button>
                </div>
              : null}
          </span>
        : null}

      {/* R8: no Delete. Leads are not deleted from the Lead screen at this
          stage. The route still exists and is not touched here - removing a
          control is not removing a capability, and which is wanted is the
          separate item flagged above. */}
    </div>
  )
}
