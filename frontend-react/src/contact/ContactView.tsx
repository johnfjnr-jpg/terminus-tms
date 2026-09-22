// ── THE CONTACT VIEW ─────────────────────────────────────────────────────
//
// Round 6 Phase 2. A WHOLE-VIEW migration on the Account pattern: React owns
// #view-contact-detail, which main.tsx createRoot()s, so the static markup
// inside it is cleared on first render and cannot collide with what React puts
// back. That is the disposition no-duplicate-ids.test.mjs recorded in Phase 1,
// and this file is what makes it true.
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { contactsOptions } from '../data/contacts'
import { ContactHost } from './ContactHost'
import { returnViewFor } from './ContactHost'
import { notMine } from '../testbed/viewLoad'

const VIEW = 'contact-detail'

interface ContactRecord {
  id: string
  payload?: Record<string, unknown>
  industry_id?: string | null
  parent_record_id?: string | null
  status?: string | null
  /** A5: the door's question. Already returned by GET /contacts/:id. */
  owner_id?: string | null
  /** R6: the route's own resolution of `parent_record_id`. */
  account?: { id: string, name: string | null } | null
  latest_revision_number?: number | null
}

export function ContactView({ contactId, navToken }: { contactId: string, navToken?: number }) {
  const shell = useShell()

  // ── PERF ROUND: THE SHARED KEY, AND A SELECTOR ────────────────────────
  //
  // The key was `['contact', contactId]` and the queryFn fetched the WHOLE
  // list to `.find()` one row - a per-contact cache entry for a whole-estate
  // resource, so two contacts meant two identical requests and nothing was
  // shared with the four other readers of the same list.
  //
  // One key, and `select` narrows it. The fetch is the estate's single
  // contacts fetch; the "not found" case moves into the selector, where it is
  // the same error the caller already renders.
  //
  // THE NAVIGATION REFETCH BELOW IS UNCHANGED AND STILL LOAD-BEARING.
  // `refetch()` ignores `staleTime`, so the walk-measured defect it exists to
  // prevent - a qualified contact reading "Unqualified" on the next visit -
  // cannot come back through the stale window.
  const contact = useQuery({
    ...contactsOptions(shell.api as never),
    select: (rows: unknown[]): ContactRecord => {
      const found = (rows as ContactRecord[]).find((c) => c.id === contactId)
      if (!found) throw new Error('That Contact no longer exists.')
      return found
    },
  })

  // ── EVERY NAVIGATION RE-READS THE RECORD ──────────────────────────────
  //
  // The vanilla did, and parity needs it: navigating back to a contact whose
  // status changed elsewhere - or whose status THIS SCREEN changed by
  // qualifying it - must not serve the cached row. Measured by the walk: after
  // a successful qualify the record read "Unqualified" on the next visit, and
  // the back button therefore went to leads instead of contacts.
  //
  // Keyed on navToken rather than on mount, because root.render() re-renders
  // this instance instead of remounting it, so useQuery sees no new observer
  // and refetchOnMount never fires.
  const refetch = contact.refetch
  useEffect(() => { if (navToken !== undefined) void refetch() }, [navToken, refetch])

  // ── C1: THE RETURN VIEW IS PUBLISHED FROM HERE ─────────────────────────
  //
  // app.js bound its back button to `cdReturnView`, a `let` in the vanilla.
  // Classic scripts share one lexical scope so that worked; a bundle cannot
  // reach the name at all. The shell now asks through a guarded accessor and
  // this is what answers it.
  //
  // Published as an EFFECT rather than during render, so there is one moment
  // where it changes and it is the record arriving.
  const status = contact.data?.status ?? null
  useEffect(() => {
    shell.setContactReturnView(returnViewFor(status))
  }, [shell, status])

  // ── detailLoaded ON EVERY NAVIGATION, NOT EVERY STATE CHANGE ──────────
  //
  // Round 41 item K, and NO DEPENDENCY ARRAY, which is the whole fix.
  //
  // Written as `useEffect(..., [settled, shell])` this fires when `settled`
  // CHANGES. Navigating to a record whose query is already cached leaves
  // `settled` true from the first render, so the dependency never changes, the
  // effect never re-runs, and `detailLoaded` is never called for that
  // navigation - while app.js has just set `is-loading` on the view expecting
  // it to be cleared.
  //
  // MEASURED BY THE LIVE WALK: re-opening the same contact left the view at
  // `class="wrap is-loading"` with the panel fully rendered underneath it,
  // permanently. Item K's own failure - an exit that forgets the flag - through
  // a memoised effect rather than an early return.
  //
  // Running on every render is right and cheap: detailLoaded removes a class,
  // and "the view has painted and is not pending" is a per-render fact rather
  // than a per-transition one.
  const settled = !contact.isPending
  useEffect(() => { if (settled) shell.detailLoaded(VIEW) })

  // ── A5: THE DOOR, ON THIS VIEW AT LAST ────────────────────────────────
  //
  // Phase 0 measured that applyReadOnlyControls had two call sites and both
  // named view-opportunity-detail, plus R11's on the Test Bed view. THE LEAD
  // VIEW HAD NO DOOR AT ALL.
  //
  // ── IT HAS THREE PARTS, AND TWO OF THEM RUN DURING RENDER ─────────────
  //
  // A first attempt did the class and the sweep in an effect and left the
  // third part out entirely. The door probe read 0 write controls reachable
  // and A6 then OPENED AN EDITOR on the same unowned lead - two instruments
  // disagreeing, which is the finding rather than a probe fault.
  //
  // The third part is the ROW's own guard. `useFieldRows` asks
  // shell.canEditFields(), which app.js answers from CAN_EDIT_BY_VIEW, which
  // for contact-detail returned a literal `true`. The class stops a mouse; the
  // register is what stops the row opening at all.
  //
  // The register and the class are written DURING RENDER, matching
  // TestBedView, because the row asks the question during ITS render. Written
  // in an effect they are one render too late - which CLAUDE.md records as a
  // fix that measures identical to no fix at all.
  const ownerId = contact.data?.owner_id ?? null
  const doorClosed = settled && contact.data ? notMine(ownerId, shell.currentUserId()) : false
  if (settled && contact.data) {
    shell.setViewOwner(VIEW, ownerId)
    const viewEl = typeof document === 'undefined' ? null : document.getElementById('view-contact-detail')
    viewEl?.classList.toggle('is-not-mine', doorClosed)
  }
  // The sweep stays in an effect: it reads the PAINTED DOM, so it must run
  // after the render the two lines above prepared.
  useEffect(() => {
    if (!settled) return
    const apply = (window as unknown as {
      applyReadOnlyControls?: (viewId: string, notMine: boolean) => void
    }).applyReadOnlyControls
    apply?.('view-contact-detail', doorClosed)
  }, [settled, doorClosed, navToken])

  if (contact.isPending) {
    return <p className="pg-item-note" data-testid="contact-loading">Loading the Contact…</p>
  }
  if (contact.isError) {
    return (
      <p className="msg-error" data-testid="contact-error">
        {contact.error instanceof Error ? contact.error.message : 'The Contact could not be loaded.'}
      </p>
    )
  }

  // A4: navToken travels to the host so the edit surface can key its drafts on
  // the VISIT, not just on the record. Navigating away and back to the SAME
  // lead must drop unsaved edits too - which keying on the id alone does not
  // do, measured on the live screen after the unit test was already green.
  return <ContactHost contact={contact.data} navToken={navToken} />
}
