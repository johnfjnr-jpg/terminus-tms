// The stage approvals workflow, pure logic and source scans. Round 41.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'
import {
  WORKFLOW_RECORD_TYPES, usesWorkflow, requiredTracks, requestState,
  mayDecide, issuedProposal, needsIssuedVersion, ISSUED_VERSION_REQUIRED,
} from '../../src/lib/transition-requests.js'

const ROOT = new URL('../../', import.meta.url).pathname
const ROUTES = readCode(ROOT + 'src/routes/transition-requests.js')

test('WORKFLOW_RECORD_TYPES is a name asserting a property, so it is measured', () => {
  // Verification 19. Opportunity is in it and Test Bed is deliberately not,
  // which is a ruling rather than an omission, so the test says both.
  assert.deepEqual([...WORKFLOW_RECORD_TYPES], ['opportunity'])
  assert.equal(usesWorkflow('opportunity'), true)
  assert.equal(usesWorkflow('test_bed'), false, 'Test Bed keeps POST /records/:id/transition, ruled')
  assert.equal(usesWorkflow('contact'), false)
  // A type outside the list must be refused by the raise route rather than
  // silently given a request nothing will ever read.
  assert.match(ROUTES, /does not use transition requests/)
})

test('the required tracks come from the rules, not from a constant', () => {
  const rules = [
    { requirement_type: 'approval_obtained', requirement_detail: { track: 'Legal', scope: 'stage' } },
    { requirement_type: 'approval_obtained', requirement_detail: { track: 'Commercial', scope: 'version' } },
    { requirement_type: 'payload_field_required', field: 'exitSolBuyersKnown' },
    { requirement_type: 'approval_obtained', requirement_detail: { track: 'Legal', scope: 'stage' } },
  ]
  assert.deepEqual(requiredTracks(rules), ['Commercial', 'Legal'], 'deduplicated and sorted')
  assert.deepEqual(requiredTracks([]), [])
  assert.deepEqual(requiredTracks(null), [])
  // SCOPE IS IGNORED, and that is the point of the workflow: both scopes collapse
  // into one reading, so a rule's scope no longer decides anything here.
  assert.deepEqual(requiredTracks([{ requirement_type: 'approval_obtained', requirement_detail: { track: 'X' } }]), ['X'])
})

test('a request is complete only when every required track has approved', () => {
  const req = ['Commercial', 'Legal', 'Technical']
  assert.deepEqual(requestState(req, []).outstanding, req)
  assert.equal(requestState(req, []).complete, false)

  const two = [{ track: 'Legal', decision: 'approved' }, { track: 'Technical', decision: 'approved' }]
  assert.deepEqual(requestState(req, two).outstanding, ['Commercial'])
  assert.equal(requestState(req, two).complete, false)

  const all = [...two, { track: 'Commercial', decision: 'approved' }]
  assert.equal(requestState(req, all).complete, true)
  assert.deepEqual(requestState(req, all).outstanding, [])

  // A track nobody asked for does not complete anything.
  assert.equal(requestState(req, [{ track: 'Finance', decision: 'approved' }]).complete, false)
})

test('A REJECTION IS DECISIVE, and it is reported before approvals are counted', () => {
  // Ruled: any rejection closes the request. The others stay as audit and do not
  // carry over, so this reports the rejection rather than the two approvals.
  const req = ['Commercial', 'Legal', 'Technical']
  const mixed = [
    { track: 'Legal', decision: 'approved' },
    { track: 'Technical', decision: 'approved' },
    { track: 'Commercial', decision: 'rejected' },
  ]
  const s = requestState(req, mixed)
  assert.equal(s.rejected, true)
  assert.equal(s.rejectedTrack, 'Commercial')
  assert.equal(s.complete, false, 'a rejected request is never complete, whatever else approved')
  assert.deepEqual(s.outstanding, [], 'and nothing is outstanding on a request that is over')
})

test('THE REQUESTER MAY NEVER APPROVE THEIR OWN REQUEST, on any track', () => {
  const REQUESTER = 'user-a'
  const APPROVER = 'user-b'
  const req = { status: 'open', requested_by: REQUESTER }
  const approvers = [
    { track: 'Commercial', user_id: REQUESTER, record_id: null },
    { track: 'Commercial', user_id: APPROVER, record_id: null },
  ]

  // The requester is a NAMED APPROVER on this track and is still refused, which
  // is the case the rule exists for: with one person seeded on all three tracks
  // it is the ONLY thing standing between a request and self-approval.
  const self = mayDecide(req, REQUESTER, approvers, 'Commercial', 'rec-1')
  assert.equal(self.allowed, false)
  assert.match(self.reason, /You raised this request/)

  assert.equal(mayDecide(req, APPROVER, approvers, 'Commercial', 'rec-1').allowed, true)

  // Not an approver on the track at all.
  const wrong = mayDecide(req, 'user-c', approvers, 'Commercial', 'rec-1')
  assert.equal(wrong.allowed, false)
  assert.match(wrong.reason, /not an approver on the Commercial track/)

  // A record-scoped approver, which is what roles per opportunity will write.
  const scoped = [{ track: 'Legal', user_id: APPROVER, record_id: 'rec-1' }]
  assert.equal(mayDecide(req, APPROVER, scoped, 'Legal', 'rec-1').allowed, true)
  assert.equal(mayDecide(req, APPROVER, scoped, 'Legal', 'rec-2').allowed, false,
    'a record-scoped approver may not decide another record')

  // A closed request cannot be decided at all.
  for (const status of ['approved', 'rejected', 'withdrawn']) {
    const closed = mayDecide({ status, requested_by: REQUESTER }, APPROVER, approvers, 'Commercial', 'rec-1')
    assert.equal(closed.allowed, false, `a ${status} request must not accept a decision`)
    assert.match(closed.reason, new RegExp(status))
  }
})

test('Proposal to Evaluation wants an ISSUED version and nothing since', () => {
  assert.equal(needsIssuedVersion('opportunity', 'Proposal', 'Evaluation'), true)
  assert.equal(needsIssuedVersion('opportunity', 'Solution Alignment', 'Proposal'), false)
  assert.equal(needsIssuedVersion('test_bed', 'Proposal', 'Evaluation'), false)
  assert.equal(ISSUED_VERSION_REQUIRED.length, 1)

  assert.equal(issuedProposal([], 10).ok, false)
  assert.match(issuedProposal([], 10).reason, /No Deal Sheet version has been issued/)

  // A version with a NULL revision_number is not an issued proposal. That is the
  // exact row that made walk finding 3 unfixable on the record it sat on.
  assert.equal(issuedProposal([{ status: 'issued', revision_number: null }], 10).ok, false)

  const issued = [{ id: 'v1', status: 'issued', revision_number: 10 }]
  assert.equal(issuedProposal(issued, 10).ok, true)
  assert.equal(issuedProposal(issued, 10).version.id, 'v1')

  // THE SECOND CHECK, and it is the one worth stating: a save after the issue
  // means the request would freeze a state nobody issued.
  const moved = issuedProposal(issued, 12)
  assert.equal(moved.ok, false)
  assert.match(moved.reason, /moved on 2 saves since the issued version/)
  assert.match(issuedProposal(issued, 11).reason, /moved on 1 save since/)

  // And an unissued draft after it is a change too.
  const withDraft = [...issued, { id: 'v2', status: 'draft', revision_number: 10 }]
  assert.equal(issuedProposal(withDraft, 10).ok, false)
  assert.match(issuedProposal(withDraft, 10).reason, /unissued draft/)
})

test('the raise route drops ONLY the approval requirements from the gate', () => {
  // A request exists to collect approvals, so refusing it for their absence
  // would refuse every request ever made. Everything else still blocks, which
  // is the ruling that the request is the gate's front door.
  assert.match(ROUTES, /computeBlocking\(/, 'the one gate computation path is still the one used')
  assert.match(ROUTES, /\.filter\(\(b\) => b\.requirement_type !== 'approval_obtained'\)/)
  assert.match(ROUTES, /error: 'This transition is not ready to be requested\.'/)
  assert.match(ROUTES, /blocking,/)
})

test('the decision route enforces the rules it must, and delegates the rest', () => {
  // WHO may decide is the route's, because it compares two rows a check
  // constraint cannot see at once. WHAT happens when the last track approves is
  // the function's, because the freeze forces an order and a crash between two
  // route statements would leave a request marked approved against a record that
  // never moved.
  assert.match(ROUTES, /const may = mayDecide\(req, request\.user\.id, approvers, track, req\.record_id\)/)
  assert.match(ROUTES, /reply\.code\(403\)\.send\(\{ error: may\.reason \}\)/)
  assert.match(ROUTES, /db\.rpc\('decide_transition_request'/)
  // The route must not do the transition itself.
  assert.ok(!/from\('records'\)[\s\S]{0,120}\.update\(/.test(ROUTES),
    'the route must not move the record; the function does it in one transaction')
})

test('withdrawal is requester-only and needs a reason, with no admin branch', () => {
  assert.match(ROUTES, /a withdrawal needs a reason/)
  assert.match(ROUTES, /req\.requested_by !== request\.user\.id/)
  assert.match(ROUTES, /Only the person who raised a request may withdraw it\./)
  // No admin concept is introduced, ruled. A second branch here would be one to
  // keep in step with a role model that does not exist.
  assert.ok(!/is_admin|isAdmin|role === 'admin'/.test(ROUTES))
})

test('PT423 has ONE place it becomes an HTTP status', () => {
  assert.match(ROUTES, /export function sendFrozen\(reply, err\)/)
  assert.match(ROUTES, /reply\.code\(423\)\.send\(\{ error: err\.message, frozen: true \}\)/)
})

test('the gate reads the request for a workflow type, and neither scope branch', () => {
  const t = readCode(ROOT + 'src/routes/transitions.js')
  assert.match(t, /if \(requestApprovals !== undefined\) \{\s*\n\s*return requestApprovals\.has\(track\)/)
  // It is a conditional on configuration, not a replacement: Test Bed keeps the
  // old path by ruling, so both scope branches must still be there.
  assert.match(t, /if \(scope === VERSION_SCOPE\)/)
  assert.match(t, /scope === 'stage'/)
})

test('THE CRITERIA STATE IS NEVER ABSENT, which is the residual resolved', () => {
  // The raise-path residual cannot be closed in SQL without a second gate
  // computation path. It is closed on the way to the approver instead: every
  // OPEN transition request carries what the gate says about it right now.
  assert.match(ROUTES, /export async function criteriaState\(db, req\)/)
  assert.match(ROUTES, /criteria: 'met'/)
  assert.match(ROUTES, /criteria: 'not evaluated'/)

  // AN ERROR IS ALSO 'not evaluated', never an omission. A field that vanishes
  // when something goes wrong is read as "fine" by the person it was for.
  assert.match(ROUTES, /const fallback = \(why\) => \(\{ criteria: 'not evaluated'/)
  assert.equal((ROUTES.match(/return fallback\(/g) || []).length, 4,
    'every failure path returns the state, none of them omits it')
  assert.match(ROUTES, /catch \(e\) \{\s*\n\s*return fallback\(/, 'a throw is a state too')

  // It uses computeBlocking rather than reimplementing the gate.
  assert.match(ROUTES, /const result = await computeBlocking\(/)
  // Both GET routes carry it, or an approver reads one screen and not the other.
  assert.equal((ROUTES.match(/await criteriaState\(db, req\)/g) || []).length, 2)

  // The CLIENT states it in words rather than a colour, and says the note.
  const app = readCode(ROOT + 'frontend/app.js')
  assert.match(app, /Exit criteria met\./)
  assert.match(app, /Exit criteria NOT EVALUATED\./)
  assert.match(app, /req\.criteria_note/)
})

test('the client reads ONE loaded value for the freeze', () => {
  const app = readCode(ROOT + 'frontend/app.js')
  assert.match(app, /let oppOpenRequest = null/)
  assert.match(app, /async function loadOppOpenRequest\(recordId\)/)
  // Loaded once per record load, and the whole view is marked from it. Eleven
  // controls testing for themselves is the second-reader shape, and one that
  // forgot to ask would be an editable field on a frozen record.
  assert.equal((app.match(/await loadOppOpenRequest\(/g) || []).length, 1)
  assert.match(app, /classList\.toggle\('is-frozen', !!oppOpenRequest\)/)
  const css = readCode(ROOT + 'frontend/style.css')
  assert.match(css, /\.is-frozen input, \.is-frozen textarea, \.is-frozen select/)
  // The controls that END the freeze live inside the banner, so it is exempt.
  assert.match(css, /\.is-frozen \.freeze-banner, \.is-frozen \.freeze-banner \* \{ pointer-events: auto/)
})

test('the tab-row control says what it now does', () => {
  const app = readCode(ROOT + 'frontend/app.js')
  // "Move to X" moved the record; requesting freezes it until three tracks
  // decide. Same position, different act, and the VERB is the property this
  // assertion has always been protecting.
  //
  // Round 41 ruling I changed the wording from `Request ${nextStage}` to a
  // fixed "Request next stage": the label was different on every stage and the
  // panel already names the target. This test failed on the old literal, which
  // is it working - but the literal was never the claim, so it now asserts the
  // verb and the destination's new home rather than the exact string it had.
  assert.match(app, /btn\.textContent = 'Request next stage'/)
  assert.ok(!/btn\.textContent = `Move to \$\{nextStage\}`/.test(app),
    'the old verb must be gone, not shadowed')
  // The destination is not lost, it moves to the title where a confirmation
  // belongs rather than into the label a person scans.
  assert.match(app, /btn\.title = `Raise a request to move this record to \$\{nextStage\}`/)
  assert.match(app, /btn\.onclick = \(\) => requestTransition\(recordId, nextStage\)/)
  // A record already awaiting approval says so rather than being inert.
  assert.match(app, /btn\.textContent = 'Awaiting approval'/)
  // AND THE BLOCKERS ARE THE ANSWER when a request is refused, not a sentence
  // about them: the request is the gate's front door.
  assert.match(app, /r\.data\?\.blocking \?\? \[\]/)
})

test('THE QUEUE says what each request is waiting for, and carries no decide controls', () => {
  const app = readCode(ROOT + 'frontend/app.js')
  const html = readCode(ROOT + 'frontend/index.html')
  const css = readCode(ROOT + 'frontend/style.css')

  assert.match(html, /<button class="nav-link" data-view="approvals">Approvals<\/button>/)
  assert.match(html, /<div id="view-approvals" class="wrap hidden">/)
  assert.match(app, /'opportunity-approval', 'approvals'\]/, 'the view must be in ALL_VIEWS or it never hides')
  assert.match(app, /if \(view === 'approvals'\) loadApprovalsQueue\(\)/)

  // WHAT IT IS WAITING FOR and WHAT THE GATE SAYS, or the approver opens each
  // one to find out.
  assert.match(app, /Exit criteria NOT EVALUATED/)
  assert.match(app, /queue-track--\$\{state\}/)
  assert.match(app, /Review only, nothing is blocked/)

  // NO DECIDE CONTROLS HERE. One implementation, on the record, so the queue and
  // the banner cannot disagree, and nobody decides without the deal in front of
  // them.
  const queue = app.slice(app.indexOf('async function loadApprovalsQueue'))
  assert.ok(!/decideRequest\(/.test(queue), 'the queue must not carry decide controls')
  assert.match(queue, /navigate\('opportunity-detail'/)

  // ONE FETCH FOR THE RECORDS, not one per row.
  assert.match(queue, /const recs = await api\('GET', '\/api\/records\?record_type=opportunity'\)/)
  assert.equal((queue.match(/await api\(/g) || []).length, 2)

  // No new accent: green still means "nothing to look at" and the warning takes
  // the ordinary foreground, the same absence-of-green the margin rule uses.
  assert.match(css, /\.queue-ok \{ color: var\(--green\); \}/)
  assert.match(css, /\.queue-warn \{ color: var\(--white\); \}/)
  assert.ok(!/queue-warn[^}]*red/i.test(css))
})

test('the decide function is atomic, and says why in its own file', () => {
  const sql = readCode(ROOT + 'supabase/migrations/20260831000004_the_function_is_the_enforcement.sql')
  assert.match(sql, /for update/, 'the request row is locked, or two last approvals race')
  // CLOSE FIRST, THEN MOVE: the freeze refuses the status update while the
  // request is open, so the order is forced rather than chosen.
  assert.ok(sql.indexOf("set status = 'approved'") < sql.indexOf('update public.records'),
    'the request must close before the record moves, or the freeze refuses the move')
  assert.match(sql, /insert into supabase_migrations\.schema_migrations/, 'Architecture 10')
})

test('RAISING IS A FUNCTION TOO, and it derives what it could have been told', () => {
  // Measured before migration 5: a direct insert to transition_requests was
  // PERMITTED, so a caller could name any from_stage and any frozen_revision.
  // The threat was not a self-inflicted freeze, which is what I first recorded:
  // a fabricated request is HONEST-LOOKING to an approver, so three people
  // approve in good faith and the record transitions WITHOUT its criteria.
  const sql = readCode(ROOT + 'supabase/migrations/20260831000005_raise_is_a_function_too.sql')

  assert.match(sql, /drop policy if exists transition_requests_insert/,
    'direct inserts are refused; the function is the only writer')
  assert.match(sql, /create or replace function public\.raise_transition_request/)
  // DERIVED, NOT TAKEN. The second time in two migrations that removing a
  // parameter closed a hole.
  assert.match(sql, /select r\.id, r\.record_type, r\.status into v_rec/)
  assert.match(sql, /select max\(rr\.revision_number\) into v_rev/)
  assert.match(sql, /v_caller uuid := auth\.uid\(\)/)
  for (const p of ['p_from_stage', 'p_record_type', 'p_frozen_revision', 'p_requested_by']) {
    assert.ok(!sql.includes(p), `${p} must not be a parameter: a parameter is an assertion by the caller`)
  }

  // And the route stops sending them, so it cannot get them wrong either.
  assert.match(ROUTES, /db\.rpc\('raise_transition_request'/)
  assert.ok(!/from\('transition_requests'\)[\s\S]{0,80}\.insert\(/.test(ROUTES),
    'the route must not insert a request directly')
})

test('A REQUEST MUST STILL DESCRIBE THE RECORD when it executes', () => {
  // The control that makes a fabricated request fail AT EXECUTION. For a
  // transition request the freeze holds both values still, so in ordinary
  // operation it can never fire, and THAT IS THE POINT: it fires only when a row
  // got in by a route the migration does not know about.
  const sql = readCode(ROOT + 'supabase/migrations/20260831000005_raise_is_a_function_too.sql')
  assert.match(sql, /if v_req\.from_stage is distinct from v_stage then/)
  assert.match(sql, /if v_req\.frozen_revision is distinct from v_rev then/)
  assert.match(sql, /errcode = 'PT412'/)
  // Checked BEFORE the approval is written, or a stale request would collect
  // decisions it can never act on.
  assert.ok(sql.indexOf("errcode = 'PT412'") < sql.indexOf('insert into public.approvals'),
    'the staleness check must precede the approval insert')
  assert.match(ROUTES, /rpcErr\.code === 'PT412'/)
  assert.match(ROUTES, /reply\.code\(412\)/)
})

test('THE FUNCTION IS THE ENFORCEMENT, not the route', () => {
  // MEASURED, not assumed. As an ordinary user with the publishable key and no
  // Fastify: inserting an approval bound to an open request was PERMITTED, and
  // calling the decide function directly was PERMITTED, both while
  // self-approving on a track the caller holds no role on.
  const sql = readCode(ROOT + 'supabase/migrations/20260831000004_the_function_is_the_enforcement.sql')

  // It reads auth.uid() rather than trusting a parameter. A parameter is an
  // assertion by the caller, and the caller is who the rule constrains.
  assert.match(sql, /v_caller\s+uuid := auth\.uid\(\)/)
  assert.ok(!/p_approver/.test(sql), 'the trusted parameter must be gone, not merely unused')
  assert.match(sql, /drop function if exists public\.decide_transition_request\(uuid, text, uuid, text, text, text\[\]\)/,
    'the old signature goes in the same migration, or the unguarded one stays callable')

  // Both rules, inside.
  assert.match(sql, /if v_req\.requested_by = v_caller then/)
  assert.match(sql, /from public\.track_approvers ta/)
  assert.match(sql, /errcode = 'PT403'/)

  // Path (a) closed: a request-bound approval comes from the function or nowhere.
  assert.match(sql, /with check \(auth\.uid\(\) = approver_id and request_id is null\)/)

  // And the raise route could not have worked at all: no INSERT policy existed.
  assert.match(sql, /create policy transition_requests_insert/)
  assert.match(sql, /with check \(requested_by = auth\.uid\(\)\)/)

  // The route keeps its check FOR THE MESSAGE, and maps the function's refusal
  // to a status rather than a 500.
  assert.match(ROUTES, /const may = mayDecide\(/)
  assert.match(ROUTES, /rpcErr\.code === 'PT403'/)
  assert.ok(!/p_approver/.test(ROUTES), 'the route must stop passing who is asking')
})

// ─────────────────────────────────────────────────────────────
// Round 41, fourth walk: X1, X3, X4
// ─────────────────────────────────────────────────────────────

test('X1: the selection is captured BEFORE the rebuild, not after', () => {
  // The whole defect was position. The first version of this fix read
  // oppTabStrip.current() at the BOTTOM of renderOppStageTabs, after the two
  // removals had erased every generated button, so it read undefined every time
  // and re-selected the record's stage over the person's own choice.
  //
  // Asserted as an ORDERING, because that is the claim. A test for "the line
  // exists" would have passed against the broken version.
  const app = readCode(ROOT + 'frontend/app.js')
  const fn = app.slice(app.indexOf('function renderOppStageTabs'))
  const capture = fn.indexOf('const selectedBeforeRebuild = oppTabStrip.current()')
  const removal = fn.indexOf("querySelectorAll('.detail-tab[data-opp-stage-tab]')")
  assert.ok(capture >= 0, 'the selection is not captured at all')
  assert.ok(removal >= 0, 'the rebuild removal was not found, so the ordering cannot be checked')
  assert.ok(capture < removal,
    `the capture is at ${capture} and the rebuild that erases the buttons is at ${removal}: `
    + 'reading the selection after the rebuild always yields undefined')
  // And the restore prefers it over the record's stage.
  assert.match(fn, /if \(stillExists\(selectedBeforeRebuild\)\)/,
    'the restore does not prefer the tab the person had open')
})

test('X3: all three spellings of the revision reach the one holder', () => {
  // A write answers revision_number, the approval page answers
  // meta.revisionNumber, a read answers latest_revision_number. Each was correct
  // in its own route and none of them agreed, so a read never updated the holder
  // and issuing a version was refused against a number 18 revisions old.
  const app = readCode(ROOT + 'frontend/app.js')
  // BOUNDED TO THE FUNCTION. The first version sliced from the function name to
  // the END OF THE FILE, so it matched latest_revision_number at
  // setOppLoadedRevision(opp.latest_revision_number) six thousand lines later
  // and passed with the key removed from the reader. Verification 17: a probe
  // that fires correctly and measures the wrong thing. Caught by calibrating.
  // MATCHED ON THE EXPRESSION, not on a slice. Two attempts got this wrong and
  // both are worth the four lines:
  //
  //   slicing to the end of the FILE matched latest_revision_number six
  //   thousand lines later and passed with the key removed;
  //   slicing to the next `function ` gave 3187 characters, because readCode
  //   replaces comments with whitespace of the same length, so a "sanity bound"
  //   on the slice length was measuring comment volume.
  //
  // The claim is about ONE expression, so the assertion reads that expression.
  const line = app.match(/const rev = [^\n]*/)
  assert.ok(line, 'the reader no longer has a single revision expression')
  for (const key of ['data?.revision_number', 'data?.meta?.revisionNumber', 'data?.latest_revision_number']) {
    assert.ok(line[0].includes(key), `the reader does not normalise ${key}: ${line[0]}`)
  }
  // ADOPT AND WARN, never silent-adopt. Ruled.
  assert.match(app, /window\.setOppLoadedRevision = function \(n, \{ source = 'load' \} = \{\}\)/,
    'setOppLoadedRevision does not distinguish a read from a load')
  assert.match(app, /if \(moved\) renderOppMovedNotice\(next\)/,
    'a read that finds the record has moved does not say so')
  // FORWARD ONLY: a lower number is a raced response, not the record going back.
  assert.match(app, /next < oppLoadedRevision\)\s*\{\s*\n?\s*return/,
    'a lower revision from a raced response would be adopted')
})

test('X4: approve is filled, reject is not, and no new colour is introduced', () => {
  const app = readCode(ROOT + 'frontend/app.js')
  const css = readCode(ROOT + 'frontend/style.css')
  assert.match(app, /btn-sm btn-primary btn-accept" onclick="decideRequest\('\$\{req\.id\}','\$\{escHtml\(t\)\}','approved'/,
    'the approve control does not carry the filled treatment')
  assert.ok(!/btn-accept" onclick="decideRequest\([^)]*'rejected'/.test(app),
    'reject must stay an outline')
  const rule = css.match(/\.btn-accept \{([^}]*)\}/)
  assert.ok(rule, 'no .btn-accept rule')
  assert.match(rule[1], /background:\s*var\(--green\)/, 'the fill is not the accent')
  assert.match(rule[1], /color:\s*var\(--dark\)/,
    'text on the accent must be --dark: --white on #66CC99 measures 1.76:1 and is unreadable')
  // ONE ACCENT. A new hue would show up as a hex literal in this rule.
  assert.ok(!/#(?!7ad4a6)[0-9a-f]{6}/i.test(rule[1]),
    `.btn-accept introduces a colour that is not the accent: ${rule[1].trim()}`)
})

test('X4/42: the dev server cannot serve a stale bundle to a walk', () => {
  // Verification 42. Two of the fourth walk's three findings were code that had
  // already been fixed, reported from a cached app.js.
  const server = readCode(ROOT + 'src/server.js')
  assert.match(server, /reply\.header\('cache-control', 'no-store, must-revalidate'\)/,
    'the frontend is not served no-store')
  assert.match(server, /if \(request\.raw\.url\?\.startsWith\('\/api\/'\)\) return/,
    'the API should be left alone by that hook')
})
