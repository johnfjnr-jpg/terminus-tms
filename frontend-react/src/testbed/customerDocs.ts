// ── D: CUSTOMER DOCUMENTS ───────────────────────────────────────────────
//
// D1: a SEPARATE RESOURCE, not a payload key.
// D2: client-supplied, distinguished by `document_kind` rather than by having
//     a name no gate rule mentions.
// D3: rendered and removed BY ROW ID, never by name - two client files
//     genuinely called "Site drawings" are two documents.
export interface CustomerDoc { id: string, name: string, url?: string | null }

export const CUSTOMER_DOCS_ROUTE = (id: string) => `/api/test-beds/${id}/customer-documents`
export const customerDocRoute = (id: string, docId: string) =>
  `${CUSTOMER_DOCS_ROUTE(id)}/${docId}`

export type DocInput =
  | { ok: true, name: string, url: string }
  | { ok: false, error: string }

/**
 * D4: BOTH a name and a link, refused before any request is made.
 *
 * One message for both, because the requirement is the pair rather than either
 * field: telling somebody the name is missing when the link is too costs a
 * round of correction.
 */
export function customerDocInput(name: string, url: string): DocInput {
  const n = String(name ?? '').trim()
  const u = String(url ?? '').trim()
  if (!n || !u) return { ok: false, error: 'A name and a link are both required.' }
  return { ok: true, name: n, url: u }
}
