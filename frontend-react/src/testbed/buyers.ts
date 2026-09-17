// ── B6: THE CLIENT BUYER LINKS ──────────────────────────────────────────
//
// Round A Phase 3, from the vanilla at 54001c5^ (`renderTbBuyerRows` and
// `linkTbBuyer`, frontend/test-bed-detail.js:1347-1424), which R11 makes the
// authority over the capabilities document.
//
// A buyer link is a `record_contacts` row written by
// POST /test-beds/:id/buyer-contacts, not a payload field, so it was never a
// batched row. It was rendered as one anyway, through a descriptor the row store
// never registered, so the row could not open, draft or save (P0.5).

/**
 * The role STRINGS are real values: written to record_contacts and named by
 * three live `contact_role_linked` gate rules. They are never renamed.
 */
export { CLIENT_BUYER_ROLES } from './descriptors'

/**
 * What the screen SHOWS for each role: the vanilla's own short labels, a
 * display rename kept in its own map so the values above never change
 * (Round 10 Phase 3.1's reasoning, and Architecture 6).
 */
export const CLIENT_BUYER_ROLE_LABELS: Readonly<Record<string, string>> = {
  'Client Commercial Buyer': 'Comm. Buyer',
  'Client Technical Buyer': 'Tech. Buyer',
  'Client Legal Buyer': 'Legal Buyer',
}

export const BUYER_CONTACTS_ROUTE = (id: string) => `/api/test-beds/${id}/buyer-contacts`

/** One link, as GET /api/test-beds/:id returns it in `buyer_contacts`. */
export interface BuyerLink { role?: string, contact_id?: string, name?: string | null }

/**
 * The link shown for a role: the FIRST the record carries. Measured in capture:
 * the route ACCEPTS a second contact in an already-linked role, so the record
 * can hold two. The vanilla read the first, and a linked role renders read-only
 * so this screen cannot create the second.
 */
export function linkedFor(links: readonly BuyerLink[] | undefined, role: string): BuyerLink | null {
  return (links ?? []).find((l) => l.role === role) ?? null
}

/**
 * 3.1: SELECTING A CONTACT WRITES IMMEDIATELY. The door is asked first; a
 * refusal resolves to the message the vanilla showed under that role.
 *
 * NO EMPTY-CHOICE GUARD HERE, and its absence is measured. There were two, one
 * here and one in the row, and calibration found each SILENT when removed alone:
 * the other always caught it (Verification 9, dead or redundant). The row's is
 * kept, because it also spares a pointless in-flight state.
 */
export async function linkBuyer(
  deps: {
    canEdit: () => boolean
    post: (body: { role: string, contact_id: string }) => Promise<{ ok: boolean, error?: string | null }>
  },
  role: string, contactId: string,
): Promise<{ sent: boolean, error: string | null }> {
  if (!deps.canEdit()) return { sent: false, error: null }
  const r = await deps.post({ role, contact_id: contactId })
  return { sent: true, error: r.ok ? null : (r.error ?? 'Failed to link contact.') }
}
