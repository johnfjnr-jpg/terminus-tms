// ── THE TEST BED VIEW ────────────────────────────────────────────────────
//
// Round 7 Phase 2e, the swap. A WHOLE-VIEW migration on the Account, Approval
// and Contact pattern: React owns #view-test-bed-detail, which main.tsx
// createRoot()s, so the static markup inside it is cleared on first render and
// cannot collide with what React puts back.
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { TestBedHost } from './TestBedHost'

const VIEW = 'test-bed-detail'

interface BedRecord {
  id: string
  status?: string
  owner_id?: string | null
  payload?: Record<string, unknown>
  buyer_contacts?: Array<{ role?: string, contact_id?: string, name?: string }>
  installer?: { name?: string, client_installed?: boolean, id?: string } | null
  account?: { id?: string } | null
  account_id?: string | null
  latest_revision_number?: number | null
}

export function TestBedView({ testBedId, navToken }: { testBedId: string, navToken?: number }) {
  const shell = useShell()

  const bed = useQuery({
    queryKey: ['test-bed', testBedId],
    queryFn: async (): Promise<BedRecord> => {
      const r = await shell.api<BedRecord>('GET', `/api/test-beds/${testBedId}`)
      if (!r.ok || !r.data) throw new Error('The Test Bed could not be loaded.')
      return r.data
    },
  })

  // EVERY NAVIGATION RE-READS THE RECORD, keyed on navToken rather than on
  // mount: root.render() re-renders this instance instead of remounting it, so
  // useQuery sees no new observer and refetchOnMount never fires. The Contact
  // walk measured exactly that - a record qualified on screen still read
  // Unqualified on the next visit.
  const refetch = bed.refetch
  useEffect(() => { if (navToken !== undefined) void refetch() }, [navToken, refetch])

  // detailLoaded ON EVERY RENDER while settled, NOT on a dependency change.
  // Navigating to a cached record leaves `settled` true from the first render,
  // so a memoised effect never re-runs and the view keeps `is-loading` for
  // ever with the panel rendered underneath it. Measured on Contact, Round 41
  // item K.
  const settled = !bed.isPending
  useEffect(() => { if (settled) shell.detailLoaded(VIEW) })

  if (bed.isPending) {
    return <p className="sub" data-testid="tb-view-loading">Loading the Test Bed.</p>
  }
  if (bed.isError || !bed.data) {
    return (
      <div data-testid="tb-view-error">
        <h2 data-testid="tb-detail-name">Not found</h2>
        <p className="msg-error">
          {bed.error instanceof Error ? bed.error.message : 'The Test Bed could not be loaded.'}
        </p>
      </div>)
  }

  // ── NO KEY, AND ITS ABSENCE IS MEASURED ──────────────────────────────
  //
  // It was written `key={bed.data.id}` to reset the host's per-record refs -
  // the arrival flags and the per-document URL boxes. Its injection came back
  // SILENT with zero failures, and reproducing that by hand confirmed why:
  // navigating to a different record gives useQuery a NEW KEY with no cache, so
  // `isPending` is true for a render, the early return above replaces the host
  // with the loading line, and the host UNMOUNTS. The key could only matter for
  // a change that never passes through pending, which a different id cannot do.
  //
  // Verification 9's guard clause: a guard whose removal changes nothing
  // observable is dead or redundant, and both are worse than absent because
  // they suggest a protection that is not working.
  return <TestBedHost bed={bed.data} />
}
