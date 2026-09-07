// ── M: THE DOCUMENTS PANEL ──────────────────────────────────────────────
//
// Round 7 Phase 2d session 1, from the M enumeration.
export interface RefDoc { document_name: string }
export interface GatedDoc {
  document: string
  current_status?: string | null
  document_location?: string | null
}
export interface DocRequirements {
  reference_docs?: RefDoc[]
  completable_documents?: GatedDoc[]
}

export interface DocRow {
  name: string
  key: string
  statusLabel: 'Approved' | 'Started' | 'Not started'
  statusClass: string
  /** offer: a gate rule to satisfy. none: already approved. not-gated: no rule. */
  confirm: 'offer' | 'none' | 'not-gated'
  url: string
}

/** M6: spaces to hyphens, every other non-alphanumeric dropped. */
export const docKey = (name: string) =>
  name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '')

export const DOCUMENTS_ROUTE = (id: string, stage: string) =>
  `/api/test-beds/${id}/document-requirements?stage=${encodeURIComponent(stage)}`

/**
 * ── M1/M2: ONE PANEL FROM BOTH KEYS, UNIONED BY NAME ────────────────────
 *
 * `reference_docs` is the stage's CATALOGUE and the authoritative answer to
 * what documents belong to this stage. `completable_documents` is the
 * per-document STATE, derived from `stage_gate_rules`.
 *
 * UNIONED, NEVER INTERSECTED. The two tables hold document names as
 * independent free strings with nothing aligning them, so an intersection
 * would make a mismatch INVISIBLE - the document would silently vanish. A
 * union shows it, and a document listed with no Confirm control is a legible
 * symptom of exactly that misalignment.
 */
export function documentRows(data: DocRequirements): DocRow[] {
  const refDocs = data.reference_docs ?? []
  const gated = data.completable_documents ?? []
  const byName = new Map(gated.map((d) => [d.document, d]))

  const names = refDocs.map((d) => d.document_name)
  for (const d of gated) if (!names.includes(d.document)) names.push(d.document)

  return names.map((name) => {
    const req = byName.get(name)
    const approved = req?.current_status === 'approved'
    // M3: approved, any other truthy status, or absent.
    const statusLabel = approved ? 'Approved' as const
      : req?.current_status ? 'Started' as const : 'Not started' as const
    return {
      name,
      key: docKey(name),
      statusLabel,
      statusClass: approved ? 'doc-status--approved'
        : req?.current_status ? 'doc-status--started' : 'doc-status--notstarted',
      // M4 and M5 are DIFFERENT answers with different reasons: one has no
      // gate rule at all, the other has already passed it.
      confirm: !req ? 'not-gated' : approved ? 'none' : 'offer',
      url: req?.document_location ?? '',
    }
  })
}
