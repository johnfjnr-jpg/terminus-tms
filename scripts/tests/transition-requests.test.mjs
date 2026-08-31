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

test('the decide function is atomic, and says why in its own file', () => {
  const sql = readCode(ROOT + 'supabase/migrations/20260831000004_the_function_is_the_enforcement.sql')
  assert.match(sql, /for update/, 'the request row is locked, or two last approvals race')
  // CLOSE FIRST, THEN MOVE: the freeze refuses the status update while the
  // request is open, so the order is forced rather than chosen.
  assert.ok(sql.indexOf("set status = 'approved'") < sql.indexOf('update public.records'),
    'the request must close before the record moves, or the freeze refuses the move')
  assert.match(sql, /insert into supabase_migrations\.schema_migrations/, 'Architecture 10')
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
