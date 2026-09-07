// ── Z: THE CLOSED PANEL ─────────────────────────────────────────────────
//
// Z2: no Confirm control and no editable URL anywhere in this tree, because
// the endpoint returns nothing either could act on.
import { closedGroups, closedSubtitle, type Lifecycle } from './closedPanel'

export function ClosedRecordPanel({ data, failed, loading }: {
  data: Lifecycle | null
  failed?: boolean
  loading?: boolean
}) {
  if (loading) {
    return <p className="empty-state" data-testid="tb-closed-groups" data-pending="true">
      Loading the completed record...</p>
  }
  if (failed || !data) {
    return <p className="empty-state" data-testid="tb-closed-groups">
      Could not load the lifecycle documents.</p>
  }
  const groups = closedGroups(data)
  return (
    <div data-testid="tb-closed">
      <p className="sub" data-testid="tb-closed-sub">{closedSubtitle(data)}</p>
      {groups.length
        ? (
          <div data-testid="tb-closed-groups" data-record="true">
            {groups.map((g) => (
              <div className="tb-closed-group" key={g.stage} data-stage={g.stage}
                data-testid={`tb-closed-group-${g.stage}`}>
                <p className="tb-closed-stage">{g.stage}</p>
                {g.documents.map((d) => (
                  <div key={d.document} data-document={d.document}
                    data-testid={`tb-closed-doc-${d.document}`}
                    className={`tb-closed-doc${d.produced ? '' : ' tb-closed-doc-missing'}`}>
                    <span className="tb-closed-doc-name">{d.document}</span>
                    <span className={`doc-status ${d.statusClass}`}>{d.statusLabel}</span>
                    <span className="tb-closed-doc-url">{d.urlText}</span>
                  </div>))}
              </div>))}
          </div>)
        : <p className="empty-state" data-testid="tb-closed-groups">
            No documents are configured for this record type.</p>}
    </div>
  )
}
