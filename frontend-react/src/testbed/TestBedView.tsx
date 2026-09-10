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
import { notMine } from './viewLoad'

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

  // ── R11: THE JS HALF OF THE DOOR, ON THIS VIEW TOO ──────────────────
  //
  // The `is-not-mine` class below is the CSS half: pointer-events and opacity
  // on inputs, textareas and selects. It stops a mouse and leaves the tab
  // order intact. Measured on the Opportunity view last round, the same gap
  // left 46 write controls keyboard-reachable on somebody else's record.
  //
  // `applyReadOnlyControls` is the half that disables form controls, marks
  // action buttons inert, neutralises div-shaped widgets by what they ARE, and
  // re-applies all of it to late-rendered content through its own observer. It
  // had two call sites and both named view-opportunity-detail: this view
  // carried the class and none of the treatment.
  //
  // ── ABOVE THE EARLY RETURN, AND THAT POSITION IS THE WHOLE POINT ────
  //
  // Placed after it first, next to the class toggle where it reads naturally.
  // The early return below means the hook then runs on some renders and not
  // others: React error #310, rendered more hooks than during the previous
  // render, and THE WHOLE TEST BED VIEW STAYED BLANK AT `is-loading`. Caught
  // by the door probe timing out on a view that never rendered.
  //
  // In an effect rather than in render because the sweep reads the PAINTED
  // DOM. `bed.data` is undefined until settled, so the owner question is asked
  // defensively and the sweep simply does not run until there is a record.
  const ownerId = bed.data?.owner_id
  const doorClosed = ownerId !== undefined && notMine(ownerId, shell.currentUserId())
  useEffect(() => {
    if (!settled || ownerId === undefined) return
    const apply = (window as unknown as {
      applyReadOnlyControls?: (viewId: string, notMine: boolean) => void
    }).applyReadOnlyControls
    apply?.('view-test-bed-detail', doorClosed)
  }, [settled, ownerId, doorClosed])

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

  // ── THE OWNERSHIP CLASS, APPLIED BEFORE THE HOST RENDERS ─────────────
  //
  // FOUND BY THE LIVE WALK, twice. app.js wrote `is-not-mine` inside
  // loadTestBedDetail and CAN_EDIT_BY_VIEW READS that class - one value, one
  // writer, shared with the Opportunity by construction. The swap retired that
  // load path and the writer went with it, so the banner was right and the DOOR
  // was wide open: 31 tab stops and 31 rows opening on somebody else's record.
  //
  // AND WRITING IT FROM AN EFFECT WAS ONE RENDER TOO LATE. `useFieldRows` reads
  // `canEditFields()` while the tree renders, and an effect runs after that -
  // so the first render of a refused record still saw an open door, and nothing
  // re-rendered to correct it. The walk measured exactly the same 31/31 with
  // the class correctly set.
  //
  // So it is written DURING RENDER, before the host is returned. A side effect
  // in render is normally wrong; this one is an idempotent class toggle on an
  // element OUTSIDE React's tree, which StrictMode's double invoke cannot
  // disturb, and the ordering is the whole point.
  //
  // The class rather than a prop, because re-pointing the door at the record
  // would give the Test Bed a second derivation of ownership beside the
  // Opportunity's - Verification 20, and the reason the registry line reads a
  // class in the first place.
  // ── THE DOOR NO LONGER READS THIS CLASS. Round 8 Phase 1 ─────────────
  //
  // Round 7 wrote it DURING RENDER because `useFieldRows` read the door while
  // rendering, and an effect was one render too late. That ordering constraint
  // is GONE: the door now reads the record through the register below, so this
  // toggle is presentation only - the treatment that makes an unowned record
  // non-interactive, which dimming alone was measured not to achieve.
  //
  // The register is what the door reads, and it is set in the same breath so
  // the two cannot describe different records.
  const readOnly = notMine(bed.data.owner_id, shell.currentUserId())
  shell.setViewOwner('test-bed-detail', bed.data.owner_id ?? null)
  const viewEl = typeof document === 'undefined'
    ? null : document.getElementById('view-test-bed-detail')
  viewEl?.classList.toggle('is-not-mine', readOnly)


  // ── KEYED ON THE RECORD, AND THE LIVE WALK IS WHY IT IS BACK ─────────
  //
  // Removed once, on a jsdom measurement that said it changed nothing: a
  // DIFFERENT record gives useQuery a new key with no cache, so `isPending` is
  // true for a render, the early return above unmounts the host, and the key
  // adds nothing.
  //
  // THE HARNESS WAS ASKING THE WRONG QUESTION. It navigated tb-1 -> tb-2. The
  // live walk went tb-1 -> the list -> tb-1, which is the ordinary thing a
  // person does, and there the query is ALREADY CACHED: `isPending` never
  // becomes true, nothing unmounts, and the previous visit's open stage tab was
  // still there. Verification 47 - the harness has to reproduce how the code is
  // INVOKED, not merely what it is given.
  //
  // `navToken` rather than the id, because the id does not change on a return
  // visit and that is exactly the case this exists for.
  return <TestBedHost key={navToken ?? bed.data.id} bed={bed.data} />
}
