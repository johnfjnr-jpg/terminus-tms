// ── THE WALK-2 LAYOUT HARNESS ────────────────────────────────────────────
//
// WHAT THIS IS, AND WHAT IT IS NOT, stated first because the difference is
// the whole of its evidential value.
//
// IT IS: the REAL Test Bed components, the REAL `frontend/style.css`, and a
// REAL browser layout engine. Every number a driver takes off this page -
// a baseline, a gap, a bounding rect - is Chromium's own, so the layout
// claims this round makes are measurements rather than readings of source.
//
// IT IS NOT: the live application. The shell services are STUBS, the record
// is a fixture, and nothing reaches Postgres. So it can say nothing about
// the data path, about ownership as the server computes it, or about
// anything a route does. Those live in the gate's HTTP stages and in
// `scripts/probe-readonly-view.mjs`, and this does not stand in for them.
//
// WHY IT EXISTS. Every existing Test Bed layout probe drives the live app
// through a dev server and a Supabase session. In a checkout with neither,
// the alternative to this harness is asserting layout from source - which is
// exactly the instrument CLAUDE.md Verification 4 and 33 exist to refuse. A
// harness that cannot see the data path is honest about one thing; a source
// scan claiming a baseline is dishonest about the thing it is measuring.
//
// WHY IT LIVES HERE AND NOT IN `scripts/`. Module resolution: this entry
// imports react and react-dom, and a bundler resolves those by walking up
// from the IMPORTER. From `scripts/` the walk reaches the repo root's
// node_modules, which has no React at all. An alias would have made it build
// from there and would be a second definition of where React lives - the
// shape Verification 20 is about. It sits outside `src/` so the conformance
// scan and the typecheck, which both enumerate `src`, do not see it.
//
// THE FIXTURE IS SHAPED BY THE ROUTE, NOT BY THE READER (Verification 47).
// `/api/stage-definitions` answers an array of {stage_name, sort_order};
// `/history` answers an OBJECT with `entries`. Both are copied from what the
// surface's own tests already establish, not from what this page would
// prefer.
import { createRoot } from 'react-dom/client'
import { ShellProvider } from '../src/ShellContext'
import type { ShellServices } from '../src/shell-services'
import { TestBedHost } from '../src/testbed/TestBedHost'
import { STAGE_NAMES } from '../src/testbed/tabModel'
import '../../frontend/style.css'

// A bed at the FIRST stage, so `nextStageFor` has a next one and the Next
// Stage action renders enabled. A bed at Closed would render the button
// disabled and reading "Final stage", which measures the wrong state for W3.
const BED = {
  id: 'tb-walk2',
  status: 'Qualification',
  owner_id: 'user-1',
  latest_revision_number: 3,
  account_id: 'acct-1',
  payload: {
    name: 'Jurong Island perimeter monitoring',
    client_organisation: 'Sembcorp Industries',
    summary: 'Twelve SafeSight units along the eastern perimeter road, with air '
      + 'quality sensing at the two gatehouses. Customer wants a go-live before '
      + 'the monsoon.',
    city: 'Singapore', country: 'Singapore', region: 'APAC',
    terminusLead: 'Brad Kerr', commercialAuthority: 'Brad Kerr',
    safesightCameras: '12', airQualitySensors: '4', hemirSensors: '0',
    estimatedInstallationDate: '2026-11-01', estGoLiveDate: '2026-12-01',
    testBedDuration: '12',
    notes: [], useCases: [],
  },
  buyer_contacts: [],
  installer: null,
}

const STAGES = STAGE_NAMES.map((stage_name, i) => ({ stage_name, sort_order: i + 1 }))

const api: ShellServices['api'] = (async (_m: string, path: string) => {
  if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: STAGES }
  if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
  if (path.endsWith('/lifecycle-documents')) {
    return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
  }
  if (path.startsWith('/api/test-beds/tb-walk2')) return { ok: true, status: 200, data: BED }
  return { ok: true, status: 200, data: [] }
}) as ShellServices['api']

// READ-ONLY IS A URL FLAG, so one build serves both halves of the door claim.
// `?readonly=1` makes the session a different identity from the record owner,
// which is what `notMine` asks and therefore what the door reads.
const readOnly = new URLSearchParams(location.search).get('readonly') === '1'

const services: ShellServices = {
  api,
  navigate: () => {},
  createFromContact: () => {},
  detailLoaded: () => {},
  getOppLoadedRevision: () => 1,
  canEditFields: () => !readOnly,
  requestChangeReason: () => {},
  currentUserEmail: () => 'walk2@terminus.invalid',
  currentUserId: () => (readOnly ? 'someone-else' : 'user-1'),
  takeTestBedLanding: () => null,
  setViewOwner: () => {},
  staleWriteHtml: () => null,
  usesWorkflow: () => false,
  attemptTransition: () => { (window as unknown as W).__walk2Clicks.push('attemptTransition') },
  setContactReturnView: () => {},
  confirmDiscard: (proceed: () => void) => { proceed() },
}

interface W { __walk2Clicks: string[] }
// THE CLICK LEDGER. W3 and W5 move action buttons, and the claim John set is
// "clicked, not assumed": a button that renders in its new place and does
// nothing is the Create-button defect this estate has already shipped once.
// The handler pushes here, so a driver asserts the EFFECT of a real browser
// click rather than the presence of the control.
;(window as unknown as W).__walk2Clicks = []

const view = document.getElementById('view-test-bed-detail')!
view.classList.toggle('is-not-mine', readOnly)
createRoot(view).render(
  <ShellProvider services={services}>
    <TestBedHost bed={BED} />
  </ShellProvider>)
