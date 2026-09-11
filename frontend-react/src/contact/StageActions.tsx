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
export function StageActions({ status, onQualify, onPark, onCreate, qualifyBlockedCount = 0 }: {
  status: string | null
  onQualify: () => void
  /** P3: how many gate requirements are still unmet. 0 enables Qualify. */
  qualifyBlockedCount?: number
  onPark: () => void
  onCreate: (kind: 'test-bed' | 'opportunity') => void
}) {
  const qualified = status === 'Qualified'
  return (
    <div className="cd-actions" data-testid="cd-actions">
      {!qualified
        ? <button type="button" id="cd-btn-qualify" data-testid="cd-btn-qualify"
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
      <button type="button" id="cd-btn-park" data-testid="cd-btn-park"
        onClick={onPark}>Nurture</button>
      {/* R8: no Unqualify. The lifecycle is forward-only at this stage. */}

      {/* D3: create is offered ONLY on a Qualified contact. */}
      {qualified
        ? <div className="cd-create-section" data-testid="cd-create-section">
            <span className="label">+ Create</span>
            <button type="button" data-testid="cd-create-test-bed"
              onClick={() => onCreate('test-bed')}>Test Bed</button>
            <button type="button" data-testid="cd-create-opportunity"
              onClick={() => onCreate('opportunity')}>Opportunity</button>
          </div>
        : null}

      {/* R8: no Delete. Leads are not deleted from the Lead screen at this
          stage. The route still exists and is not touched here - removing a
          control is not removing a capability, and which is wanted is the
          separate item flagged above. */}
    </div>
  )
}
