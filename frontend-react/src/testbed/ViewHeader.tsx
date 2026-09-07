// ── R1 and L6: THE HEADER AND THE READ-ONLY BANNER ──────────────────────
import { headerOf, OWNERSHIP_REFUSAL_TEXT } from './viewLoad'

export function ViewHeader({ record, readOnly }: {
  record: { payload?: { name?: string, client_organisation?: string } } | null
  readOnly: boolean
}) {
  const { name, client } = headerOf(record)
  return (
    <div data-testid="tb-view-header">
      <h2 data-testid="tb-detail-name">{name}</h2>
      {/* An empty client renders an EMPTY element rather than none: the header
          keeps its shape across records, which is what stops the name moving
          when one record has an organisation and the next does not. */}
      <p className="sub" data-testid="tb-detail-client">{client}</p>

      {/* L6: the banner is the only PER-VIEW part. The class, the value and the
          stylesheet rule are shared with the Opportunity; the banners differ
          only because they sit in different documents. */}
      <div data-testid="tb-readonly-banner">
        {readOnly
          ? (
            <div className="freeze-banner" data-testid="tb-readonly-banner-body">
              <p className="label">Read only &middot; another user&apos;s record</p>
              {/* L7: view-not-edit, not access-denied. RLS is the boundary;
                  this stops work that will be refused. */}
              <p>{OWNERSHIP_REFUSAL_TEXT}</p>
            </div>)
          : null}
      </div>
    </div>
  )
}
