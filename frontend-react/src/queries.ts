// ── QUERY CONVENTIONS, SET IN ROUND 1 ────────────────────────────────────
//
// These are the conventions the brief records, in the one place every later
// surface will copy from. They exist because of five named Round 41 defects,
// not because a cache is tidy:
//
//   one key scheme          - three modules each held a private revision number
//                             for one Opportunity, and an exit-criterion tick
//                             left one of them behind. One key, one entry, no
//                             second copy to drift.
//   invalidate after write  - U9/U10: a held revision went stale and the next
//                             write was refused. Invalidation is the ONLY
//                             refresh mechanism; no hand-rolled holder.
//   isError rendered        - the poll's `if (!r.ok) return` made a failed read
//                             indistinguishable from a quiet record for four
//                             investigations. A failing query is never silent.
import type { ShellServices } from './shell-services'

export const approvalPageKey = (id: string) => ['opportunity', id, 'approval-page'] as const

// The endpoint's payload is `src/lib/approval-page.js`'s output. Phase 2 types
// it against the thirteen shapes in the Phase 0 report; Phase 1 needs only
// enough to render a title and an error, and typing it further now would be
// typing it from the component rather than from the enumeration.
export interface ApprovalPageResponse {
  record?: { reference?: string | null; status?: string | null }
  versionLabel?: string | null
  [key: string]: unknown
}

export function approvalPageQuery(services: ShellServices, id: string) {
  return {
    queryKey: approvalPageKey(id),
    queryFn: async (): Promise<ApprovalPageResponse> => {
      const r = await services.api<ApprovalPageResponse>(
        'GET', `/api/opportunities/${id}/approval-page`)
      // THE SERVER'S OWN SENTENCE, carried as the error. A rejected promise is
      // what puts TanStack Query into isError; returning a shape with an error
      // field inside it would make a failure look like data.
      if (!r.ok) {
        const message = (r.data as { error?: string } | undefined)?.error
          ?? 'The approval page could not be loaded.'
        throw new Error(message)
      }
      return r.data as ApprovalPageResponse
    },
    // A price under approval is read, decided on, and left. Refetching it
    // underneath somebody mid-decision is the opposite of what this page is
    // for, so staleness is explicit and refresh is invalidation.
    staleTime: Infinity,
    retry: false,
  }
}
