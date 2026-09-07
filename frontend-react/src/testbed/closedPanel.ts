// ── Z: THE CLOSED PANEL ─────────────────────────────────────────────────
//
// Z2: READ-ONLY IS STRUCTURAL, NOT COSMETIC. There is no Confirm control and no
// editable URL because the endpoint returns nothing either could act on - no
// gate rule, no required_status. A closed Test Bed's documents ARE the record,
// and altering them after closure undermines the audit trail; the backward
// transition path is how something changes, and it records the move as a
// regression.
export interface ClosedDoc {
  document: string
  produced?: boolean
  status?: string | null
  document_location?: string | null
}
export interface ClosedGroup { stage: string, documents: ClosedDoc[] }
export interface Lifecycle { total: number, produced: number, groups: ClosedGroup[] }

export const LIFECYCLE_ROUTE = (id: string) => `/api/test-beds/${id}/lifecycle-documents`

export interface ClosedRow {
  document: string
  produced: boolean
  statusLabel: string
  statusClass: string
  urlText: string
}

/**
 * Z3: the route's group order IS lifecycle order, from `stage_definitions`
 * sort order, and it is preserved rather than re-imposed. A stage that produced
 * no documents is OMITTED, because a flat list of nine documents loses the
 * shape of what happened and an empty group adds nothing back.
 */
export function closedGroups(data: Lifecycle): Array<{ stage: string, documents: ClosedRow[] }> {
  return (data.groups ?? [])
    .filter((g) => (g.documents ?? []).length > 0)
    .map((g) => ({
      stage: g.stage,
      documents: g.documents.map((d) => ({
        document: d.document,
        produced: !!d.produced,
        // Z5: never produced SAYS so, rather than rendering a blank row that
        // reads like a missing URL.
        statusLabel: d.status
          ? (d.status === 'approved' ? 'Approved' : d.status)
          : 'Not produced',
        statusClass: d.status === 'approved' ? 'doc-status--approved'
          : d.status ? 'doc-status--started' : 'doc-status--notstarted',
        urlText: d.document_location
          ? d.document_location
          : (d.produced ? 'No document URL recorded' : ''),
      })),
    }))
}

/**
 * Z4: IT DEGRADES HONESTLY. A Test Bed can reach Closed with documents missing
 * via the backward transition path, so the count is stated rather than implied.
 */
export const closedSubtitle = (data: Lifecycle) =>
  data.produced === data.total
    ? `All ${data.total} documents produced across the lifecycle.`
    : `${data.produced} of ${data.total} documents produced. `
      + `${data.total - data.produced} were never recorded.`
