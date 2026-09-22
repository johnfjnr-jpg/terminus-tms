// ── ONE CONTACTS FETCH, SHARED BY EVERY CONSUMER ─────────────────────────
//
// Phase 0 measured a boot issuing FIVE full-list `GET /api/contacts`. Four
// were the same vanilla function, because `showApp` calls `navigate` four
// times and `navigate` calls `loadContactsData` for two views; the fifth was
// the React bundle. Seven readers in total, four of which throw away almost
// everything they ask for.
//
// WHAT THE PILE-UP COSTS IS NOT CONTENTION. Eight concurrent copies measured
// x1.1 each, so they do not slow one another down. Each request is an
// independent DRAW from a heavy-tailed distribution and the page waits for
// the slowest of them: P(one draw > 1200ms) is 7% and P(slowest of five >
// 1200ms) is 29%. Cutting five draws to one is the whole of the fix.
//
// ── WHY THE QUERY CLIENT IS THE MECHANISM ────────────────────────────────
//
// `fetchQuery` already does the two things Phase 0 asks for and does them in
// one place: it DEDUPLICATES in-flight requests on a key, and it serves
// within `staleTime` without a round trip. Writing a second promise-cache
// beside it would be Verification 20's two readers by construction.
//
// AND IT IS SHARED WITH THE VANILLA, because "one fetch per page load
// serving all consumers" cannot be met by two independent caches. `main.tsx`
// publishes `window.tmsContacts` over this, and `app.js` calls it - the same
// argument `tmsFormatDate` is already published under, and the same
// direction the migration runs in.
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import type { ApiResult } from '../shell-services'

/** Every consumer of the whole list uses this key. There is no second one. */
export const CONTACTS_KEY = ['contacts', 'all'] as const

// ── THE STALE WINDOW, AND WHY IT IS THIS ─────────────────────────────────
//
// Long enough that one page load's consumers share a single request, and
// short enough that it is not a cache anybody reasons about. The measured
// settle for a view is 2.5s to 5.1s, so 30s covers a load and the navigation
// that usually follows it.
//
// IT IS NOT WHAT KEEPS THE SCREEN FRESH, and that distinction matters. Every
// path that must see a write uses `force`, which invalidates first, so
// freshness is a property of the WRITE rather than of this number. Raising or
// lowering it cannot make a saved change invisible.
export const CONTACTS_STALE_MS = 30_000

type ApiFn = (method: string, path: string, body?: unknown) => Promise<ApiResult<unknown>>

async function fetchList(api: ApiFn): Promise<unknown[]> {
  const r = await api('GET', '/api/contacts')
  if (!r.ok || !Array.isArray(r.data)) throw new Error('The contacts could not be loaded.')
  return r.data as unknown[]
}

export function contactsOptions(api: ApiFn) {
  return { queryKey: CONTACTS_KEY, staleTime: CONTACTS_STALE_MS, queryFn: () => fetchList(api) }
}

/** The whole list, for a component that renders from it. */
export function useAllContacts<T = unknown>() {
  const shell = useShell()
  return useQuery({ ...contactsOptions(shell.api as ApiFn) }) as
    ReturnType<typeof useQuery<unknown[], Error, T[]>>
}

/**
 * The whole list, for a caller that is not a component: an effect, a reload
 * registered with a host, or the vanilla shell through the seam.
 *
 * `force` INVALIDATES FIRST, which is what a post-write reload needs. Without
 * it a save followed by a reload inside the stale window would repaint the
 * value the save replaced - the one way a shared cache can be worse than no
 * cache at all.
 */
export async function fetchContacts(
  qc: QueryClient, api: ApiFn, opts: { force?: boolean } = {},
): Promise<unknown[]> {
  if (opts.force) await qc.invalidateQueries({ queryKey: CONTACTS_KEY })
  return qc.fetchQuery(contactsOptions(api))
}
