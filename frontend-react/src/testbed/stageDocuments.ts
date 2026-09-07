// ── C: CONFIRMING AND SAVING A STAGE DOCUMENT ───────────────────────────
//
// Round 7 Phase 2d session 3.
//
// ONE ROUTE, TWO MEANINGS, and `approve` is the whole difference. It defaults
// to TRUE on the server so every pre-existing caller behaves as it did.
//
// C2, AND IT IS A GATE BYPASS RATHER THAN A STYLE. `status` was a hardcoded,
// unconditional 'approved', so saving a URL APPROVED the document as a side
// effect. The URL points at the WORKING COPY - set while the document is still
// being written - and satisfying a gate by pasting a link is precisely the
// failure the gate exists to prevent. That is why these are two functions and
// not one with a flag a caller can forget.
export const completeDocumentRoute = (id: string) =>
  `/api/test-beds/${id}/complete-document`

export interface ConfirmBody {
  document_type: string
  document_location?: string
}

/**
 * C3: a confirm CARRIES whatever is in the URL box, so an operator who pastes a
 * link and confirms in one go does not lose it - and OMITS the key entirely
 * when the box is empty, rather than sending '' and clearing a stored URL.
 */
export function confirmBody(documentType: string, url: string): ConfirmBody {
  const u = String(url ?? '').trim()
  return u ? { document_type: documentType, document_location: u }
    : { document_type: documentType }
}

/**
 * A URL save NEVER approves. The empty string is sent rather than omitted here,
 * because clearing the box is a legitimate write: it removes a wrong link.
 */
export function saveUrlBody(documentType: string, url: string) {
  return {
    document_type: documentType,
    document_location: String(url ?? '').trim(),
    approve: false as const,
  }
}

/** C4: per row, and it says which outcome rather than only that one happened. */
export const docFeedback = (ok: boolean, error: string | null) =>
  ok
    ? { text: 'URL saved.', kind: 'ok' as const }
    : { text: `Could not save URL: ${error ?? 'unknown error'}`, kind: 'err' as const }
