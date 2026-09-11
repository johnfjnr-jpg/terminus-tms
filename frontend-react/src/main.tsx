import { StrictMode } from 'react'
import { ReferenceHost } from './reference/ReferenceHost'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from './ShellContext'
import { LeadsList } from './leads/LeadsList'
import { shellServices } from './shell-services'
import { ApprovalView } from './ApprovalView'
import { AccountView } from './account/AccountView'
import { ContactView } from './contact/ContactView'
import { TestBedView } from './testbed/TestBedView'
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
const TESTBED_VIEW = 'test-bed-detail'

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
    loadTestBedDetail?: (testBedId: string) => void
    /**
     * P4: the Leads list, mounted into #live-leads-rows.
     *
     * NOT `renderLeadsCards`, and the name is the whole point. app.js declares
     * `function renderLeadsCards()` at top level, and a top-level declaration
     * in a classic script IS a property of window - app.js loads AFTER this
     * bundle, so it would overwrite this registration and the delegation would
     * call itself. Verification 41 records that exact collision costing a live
     * walk on the Test Bed view.
     */
    mountLeadsList?: () => void
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
// ── A NAVIGATION TOKEN, BECAUSE A RE-RENDER IS NOT A REMOUNT ─────────────
//
// Round 6 Phase 2, from a defect the live walk found. Navigating to a record
// the view is ALREADY showing calls this again, and root.render() re-renders
// the same component instance rather than mounting a new one. So every
// mount-shaped assumption silently stops holding:
//
//   - an effect with unchanged deps does not re-run, which left `is-loading`
//     on the view permanently
//   - useQuery sees no new observer, so it serves CACHED data and never
//     refetches - and the walk measured a contact still reading "Unqualified"
//     after it had been qualified
//
// The vanilla re-read the record on every load. This token is how a view can
// too: it changes on every navigation, including a repeat one, and a view that
// wants per-navigation behaviour depends on it. Views that do not are
// unchanged.
const navTokens = new Map<string, number>()

// ── P4: MOUNTING A LIST, WHICH IS NOT A DETAIL VIEW ──────────────────────
//
// `register` above owns a whole `#view-*` container and takes a record id.
// The Leads list is neither: it has no id, and it renders into the existing
// `#live-leads-rows` INSIDE a view whose page-head, Mine toggle and New lead
// button remain the shell's. So it mounts into that element rather than the
// view, and leaves everything around it alone.
//
// That is the deliberate narrow choice. Taking the whole `#view-leads`
// container would clear it on first render - createRoot does - and the toggle
// and the New lead button would go with it, which is the exact fault recorded
// against the first React approval view.
function mountList(containerId: string, render: (navToken: number) => React.ReactElement) {
  return function (): void {
    const container = document.getElementById(containerId)
    if (!container) return
    const navToken = (navTokens.get(containerId) ?? 0) + 1
    navTokens.set(containerId, navToken)
    let root = roots.get(containerId)
    if (!root) { root = createRoot(container); roots.set(containerId, root) }
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ShellProvider services={shellServices}>{render(navToken)}</ShellProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
  }
}

function register(view: string, render: (id: string, navToken: number) => React.ReactElement) {
  return function (id: string): void {
    try {
      const container = document.getElementById(`view-${view}`)
      if (!container) { shellServices.detailLoaded(view); return }
      const navToken = (navTokens.get(view) ?? 0) + 1
      navTokens.set(view, navToken)
      let root = roots.get(view)
      if (!root) { root = createRoot(container); roots.set(view, root) }
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <ShellProvider services={shellServices}>{render(id, navToken)}</ShellProvider>
          </QueryClientProvider>
        </StrictMode>,
      )
    } catch (err) {
      shellServices.detailLoaded(view)
      throw err
    }
  }
}

window.loadApprovalPage = register(APPROVAL_VIEW,
  (id, navToken) => <ApprovalView oppId={id} navToken={navToken} />)
window.loadAccountDetail = register(ACCOUNT_VIEW,
  (id, navToken) => <AccountView accountId={id} navToken={navToken} />)
// ── THE CONTACT VIEW, Round 6 Phase 2 ────────────────────────────────────
//
// A whole-view migration like the two above, so createRoot owns
// #view-contact-detail and clears the static markup on first render.
// P4: the Leads list. app.js's renderLeadsCards() delegates here.
window.mountLeadsList = mountList('live-leads-rows',
  (navToken) => <LeadsList navToken={navToken} />)

window.loadContactDetail = register(CONTACT_VIEW,
  (id, navToken) => <ContactView contactId={id} navToken={navToken} />)

// ── THE TEST BED VIEW, Round 7 Phase 2e ──────────────────────────────────
//
// A whole-view migration like the three above, so createRoot owns
// #view-test-bed-detail and clears the static markup on first render.
//
// THE ARRIVAL FLAG IS THE navToken, not a second boolean. The vanilla kept
// `tbFreshNavigation`, set only by navigate() because twelve of its thirteen
// load call sites were saves. After the swap the host reloads ITSELF, so this
// registration is reached only by a real navigation and the token that
// increments here is exactly the signal the flag carried.
window.loadTestBedDetail = register(TESTBED_VIEW,
  (id, navToken) => <TestBedView testBedId={id} navToken={navToken} />)

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
