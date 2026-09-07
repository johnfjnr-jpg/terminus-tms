import { StrictMode } from 'react'
import { ReferenceHost } from './reference/ReferenceHost'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from './ShellContext'
import { shellServices } from './shell-services'
import { ApprovalView } from './ApprovalView'
import { AccountView } from './account/AccountView'
import { ContactView } from './contact/ContactView'
import { DealPanel } from './deal/DealPanel'
import { valuesFromPayload, uiFromPayload } from './deal/payload'
import { saveDeal } from './deal/seam'
import { VersionCardHost } from './versions/VersionCardHost'
import type { VersionSeam } from './versions/VersionCardHost'
import type { DealFormSeam } from './deal/seam'

// ── WHAT THIS BUNDLE DOES THIS ROUND, AND NOTHING ELSE ───────────────────
//
// It registers ONE global, `window.loadApprovalPage`, which the vanilla router
// already calls at app.js:186. The vanilla shell stays the shell and the
// router; React owns one container.
//
// The revert is restoring one script tag, and that stays true only while this
// file adds exactly one global and touches nothing else.

const APPROVAL_VIEW = 'opportunity-approval'
const ACCOUNT_VIEW = 'account-detail'
const CONTACT_VIEW = 'contact-detail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Invalidation is the only refresh mechanism this round, so nothing
      // refetches on a window focus underneath somebody mid-decision.
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

// ONE ROOT PER CONTAINER, REUSED. createRoot on a container that already has
// one warns and leaks, and the router calls these on every navigation.
const roots = new Map<string, Root>()

interface OppRecord {
  id: string
  payload?: Record<string, unknown>
  opportunity_details?: { test_bed_cost?: number }
}

declare global {
  interface Window {
    loadApprovalPage?: (oppId: string) => void
    loadAccountDetail?: (accountId: string) => void
    loadContactDetail?: (contactId: string) => void
    initOpportunityDealPanel?: (opp: OppRecord) => void
    initOpportunityReferencePanel?: (opp: OppRecord) => void
    initOpportunityDealVersions?: (o: { opportunityId: string, seam: DealFormSeam }) => void
    oppPatch?: (id: string, body: unknown) => Promise<{ ok: boolean, status?: number, data?: unknown }>
    dealFormSeam?: DealFormSeam
  }
}

// The registration shape both surfaces share. `detailLoaded` fires on the two
// paths the component itself can never reach - no container, and a mount that
// throws - which is Round 41 item K at the layer above the view.
function register(view: string, render: (id: string) => React.ReactElement) {
  return function (id: string): void {
    try {
      const container = document.getElementById(`view-${view}`)
      if (!container) { shellServices.detailLoaded(view); return }
      let root = roots.get(view)
      if (!root) { root = createRoot(container); roots.set(view, root) }
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <ShellProvider services={shellServices}>{render(id)}</ShellProvider>
          </QueryClientProvider>
        </StrictMode>,
      )
    } catch (err) {
      shellServices.detailLoaded(view)
      throw err
    }
  }
}

window.loadApprovalPage = register(APPROVAL_VIEW, (id) => <ApprovalView oppId={id} />)
window.loadAccountDetail = register(ACCOUNT_VIEW, (id) => <AccountView accountId={id} />)
// ── THE CONTACT VIEW, Round 6 Phase 2 ────────────────────────────────────
//
// A whole-view migration like the two above, so createRoot owns
// #view-contact-detail and clears the static markup on first render.
window.loadContactDetail = register(CONTACT_VIEW, (id) => <ContactView contactId={id} />)

// ── THE COMMERCIALS PANEL ────────────────────────────────────────────────
//
// `app.js` calls `window.initOpportunityDealPanel?.(opp)` during the record
// load, exactly as it called the vanilla's. Everything else about the shell is
// unchanged: the tab mechanics, the freeze banner, `oppPatch`, the revision
// handshake and `openDiscardConfirm` all stay where they are.
//
// THE VANILLA MARKUP IS HIDDEN, NOT DELETED, and that is what makes the revert
// one line. Restoring the `opportunity-deal.js` script tag re-assigns
// `window.initOpportunityDealPanel` AFTER this module has run - modules
// execute before classic-script assignment order matters here only because the
// vanilla is a module too, and index.html loads it after the bundle - so the
// vanilla's assignment wins, this mount never runs, and the static markup is
// never hidden. Nothing else has to be undone.
const DEAL_CONTAINER = 'deal-form-root'
const VANILLA_FORM = 'deal-form-vanilla'
let dealRoot: Root | null = null

window.initOpportunityDealPanel = function (opp: OppRecord): void {
  const container = document.getElementById(DEAL_CONTAINER)
  if (!container) return
  document.getElementById(VANILLA_FORM)?.classList.add('hidden')

  const payload = opp.payload ?? {}
  // The version machinery is HANDED the seam rather than reaching for it, and
  // it is handed it once the panel has one - which is after the first render,
  // not before it.
  const onSeamReady = (seam: DealFormSeam) => {
    // PUBLISHED UNDER THE SAME NAME THE VANILLA USED. The version machinery is
    // handed the seam and does not read this, but the ruled interface is what
    // makes the two forms interchangeable, and one probe covers both only if
    // the object is reachable by the same name under each.
    window.dealFormSeam = seam
    window.initOpportunityDealVersions?.({ opportunityId: opp.id, seam })
  }

  if (!dealRoot) dealRoot = createRoot(container)
  dealRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ShellProvider services={shellServices}>
          <DealPanel
            initialValues={valuesFromPayload(payload)}
            initialUi={uiFromPayload(payload)}
            testBedCost={opp.opportunity_details?.test_bed_cost ?? 0}
            onSeamReady={onSeamReady}
            onPersist={async (p) => {
              // `oppPatch` keeps owning the route, the expected_revision, the
              // 409 retry and the revision adoption. A refusal REJECTS, because
              // freezeCurrentState must be able to refuse the version.
              const r = await saveDeal(opp.id, p, window.oppPatch!)
              if (!r.ok) throw new Error(
                (r.data as { error?: string } | undefined)?.error ?? 'The pricing could not be saved.')
            }}
            currentVersionRejection={() => null}
            refreshVersionActions={() => {}} />
        </ShellProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// ── THE VERSION CARD ─────────────────────────────────────────────────────
//
// Round 4 Phase 2. The form's init hands this its seam, exactly as it handed
// the vanilla card one, so the ENTRY IS UNCHANGED and the card consumes
// whichever seam arrives.
//
// THE CARD GETS ITS OWN LOAD-ORDER REVERT, independent of the form's. The
// vanilla card's markup is hidden rather than deleted and its script tag sits
// commented in place: restoring that one line re-registers
// `initOpportunityDealVersions` after this module has run, so the vanilla wins,
// this mount never fires, and nothing hides the markup. Reverting the card does
// not revert the form, and reverting the form does not revert the card.
// ── THE REFERENCE PANEL. Round 5, Phase 2 ───────────────────────────────
//
// Idempotent for one opportunity, the Round 4 shape: app.js calls this on
// every loadOpportunityDetail, and a save triggers one. Round 4 measured that
// a trailing CLEAR is what loses typed text rather than the re-render itself,
// but the rows here hold drafts, so an unnecessary remount is a worse risk on
// this surface than it was there, not a better one.
const REF_CONTAINER = 'ref-root'
const REF_VANILLA = 'ref-vanilla'
let refRoot: Root | null = null
let refOppId: string | null = null
let refReload: (() => void) | null = null

window.initOpportunityReferencePanel = function (opp: OppRecord): void {
  const container = document.getElementById(REF_CONTAINER)
  if (!container) return
  document.getElementById(REF_VANILLA)?.classList.add('hidden')
  if (refRoot && refOppId === opp.id) { refReload?.(); return }
  refOppId = opp.id
  if (!refRoot) refRoot = createRoot(container)
  refRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ShellProvider services={shellServices}>
          <ReferenceHost opp={opp} registerReload={(fn) => { refReload = fn }} />
        </ShellProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

const VERSION_CONTAINER = 'deal-version-root'
const VANILLA_CARD = 'deal-version-vanilla'
let versionRoot: Root | null = null
// ── INIT IS IDEMPOTENT FOR ONE OPPORTUNITY. Round 4, Phase 3 ─────────────
//
// app.js calls this on every loadOpportunityDetail, and a save triggers one,
// so the card was re-rendering for a record it was already showing. MEASURED:
// five init calls across six saves, and 37 on a page driven for a while.
//
// The vanilla's init is called just as often and does far less: it resets the
// range, wires once, and calls loadVersions(). It never rebuilds the reason
// box, which is why the vanilla cannot lose typed text. Matching that shape
// here means re-rendering the tree only when the RECORD changes, and
// refreshing an unchanged one through the feed the card already publishes.
let versionOppId: string | null = null
let versionReload: (() => void) | null = null

window.initOpportunityDealVersions = function (
  { opportunityId, seam }: { opportunityId: string, seam: DealFormSeam },
): void {
  const container = document.getElementById(VERSION_CONTAINER)
  if (!container) return
  document.getElementById(VANILLA_CARD)?.classList.add('hidden')
  // Same record, already mounted: refresh through the published feed, which is
  // the vanilla's renderVersionList() and touches the list, not the controls.
  if (versionRoot && versionOppId === opportunityId) {
    // The vanilla's init calls loadVersions(), so an idempotent init has to
    // refetch too or the list goes stale after a change made elsewhere.
    versionReload?.()
    return
  }
  versionOppId = opportunityId
  if (!versionRoot) versionRoot = createRoot(container)
  versionRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ShellProvider services={shellServices}>
          <VersionCardHost
            registerReload={(reload) => { versionReload = reload }}
            opportunityId={opportunityId}
            seam={seam as unknown as VersionSeam}
            api={(m, p, b) => window.api!(m, p, b) as Promise<{ ok: boolean, status?: number, data?: unknown }>} />
        </ShellProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
