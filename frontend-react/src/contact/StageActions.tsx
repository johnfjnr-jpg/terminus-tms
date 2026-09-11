// ── U1 TO U3, D1 TO D3: THE STAGE ACTIONS ────────────────────────────────
//
// renderCdActions in the vanilla draws Qualify, Park AND Move to Unqualified.
// The Phase 2 panel had only Qualify, so the capability was two thirds absent
// while reading as present - which is what the accounting instrument found and
// a screenshot showed as "a button is missing".
export function StageActions({ status, onQualify, onPark, onUnqualify, onDelete, onCreate, qualifyBlockedCount = 0 }: {
  status: string | null
  onQualify: () => void
  /** P3: how many gate requirements are still unmet. 0 enables Qualify. */
  qualifyBlockedCount?: number
  onPark: () => void
  onUnqualify: () => void
  onDelete: () => void
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
      {/* U3: offered only when the contact is not already Unqualified. */}
      {status !== 'Unqualified'
        ? <button type="button" id="cd-btn-unqualify" data-testid="cd-btn-unqualify"
            onClick={onUnqualify}>Move to Unqualified</button>
        : null}

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

      <div className="cd-delete-section" data-testid="cd-delete-section">
        <button type="button" className="btn-text" data-testid="cd-btn-delete"
          onClick={onDelete}>&times; Delete</button>
      </div>
    </div>
  )
}
