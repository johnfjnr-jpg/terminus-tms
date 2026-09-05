# Migration Round 1: the Vite shell and the approval view pilot

**Final, 2026-09-05.** Decisions ruled by John this date: the field-row
component is in this round (Phase 4); TanStack Query enters with the pilot;
the React tree is TypeScript; the vanilla view file is kept unloaded until
the Round 2 gate; the dev workflow is build-watch on one origin. Recorded
here so they are revisitable, not re-litigated.

**STANDING DELEGATION RULE, 2026-09-05.** Implementation decisions (tooling,
guards, test mechanics, code structure) go with the advisor's recommendation by
default, recorded in the round report with reasoning, revisitable. John rules
only on: scope beyond the brief, anything touching live data, auth, security
posture or deployment, new dependencies with commercial implications, and the
round exit gates. **Under this rule: the click-time guard is IN (Phase 2 item 7);
the dist staleness gate stage is IN (Phase 3).**

**PHASES 2 AND 3 EXECUTE AS ONE SESSION WITH ONE REPORT**, by John's ruling of
2026-09-05. Checkpoints are unchanged: the report is reviewed before Phase 4.

**Item 6 rulings, 2026-09-05:** root `engines` to `^20.19.0 || >=22.12.0`
(matching Vite exactly, no wider than the constraint that exists); CI
`node-version` to `'>=22.12 <23'` (the pin says what is required). Render
remains a deployment-time check per the existing resolution.

**Entry state, verified against origin/main:** the Round 41 defect thread is
closed and landed. `c078360` (Item A) is an ancestor of HEAD; the walk commit
covering A2 and items B through K is an ancestor of HEAD; the consolidation
commit before the Round 0 report closed the round at 16/16 gate stages,
437/437 pure, 92/92 database. Nothing from the defect thread is pending in
vanilla against the approval view.

This is a pilot in sequence, not in commitment. Round 0 measured the approval
view as the first surface: 253 lines, one global exported, zero inbound inline
references, read-mostly, revertible without touching another file, and it
exercises the shared `src/lib` evaluator through its endpoint. This round
stands up the shell and migrates that one surface. Commercials does not start
until the exit gate at the bottom of this brief is passed on John's word.

Companion documents: `MIGRATION_ROUND_0.md` (estimate and order),
`MIGRATION_FIELD_ROW_CONTRACT.md` (the behaviour a field-row replacement is
verified against). `CLAUDE.md` Verification 47 governs every test written in
this round: **tests are derived from the contract documents and the behaviour
lists in this brief, never from the vanilla source and never from the new
components.**

---

## What this round does not do

- It does not migrate any surface with field rows. The approval view has none;
  the contract's own table confirms it is not one of the five implementations.
- It does not delete `frontend/opportunity-approval.js`. The vanilla file
  stays in tree, unloaded, until the Round 2 entry gate confirms the pilot.
  Revert is restoring one script tag.
- It does not touch `src/lib`. 5,530 lines, isomorphic, 0 external imports,
  323 behavioural tests: it is imported by the React bundle, not copied, not
  moved, not edited. Any change to a `src/lib` file in this round is a
  finding, not a fix.
- It does not introduce a second computation path. The vanilla view's header
  comment is carried forward as law: NOTHING IS COMPUTED CLIENT-SIDE. Every
  figure and sentence comes from `GET /api/opportunities/:id/approval-page`.

---

## The two contracts in play

**The approval view's contract is the endpoint plus the rendered-behaviour
list below.** The field-row contract does not apply to it, because the view
has no rows. Conflating the two would verify the pilot against behaviours it
cannot exhibit and call that coverage.

**The field-row contract applies to the component built in Phase 4**,
which ships with contract-derived tests and no production consumer. Its first
consumer arrives with the first row-bearing surface in Round 2.

---

## Phase 0: investigation (no product code)

Claude Code reads and reports before anything is built. Findings are named
before fixed; nothing proceeds past this phase without John's word.

1. Confirm the `onSend` header hook in `src/server.js` covers a second static
   prefix, or report what it would take. The React bundle must ship with the
   same headers as the rest of the frontend.
2. Enumerate every caller of `window.loadApprovalPage`. Expected: exactly one,
   `app.js` line ~186. A second caller is a finding.
3. Enumerate every test and probe that references
   `frontend/opportunity-approval.js` by path or asserts against its source.
   Expected: one, `commercials-wiring.test.mjs` ~758 (`ds-row` liveness).
   Report any others found.
4. Confirm a Vite build in a `frontend-react/` workspace can import
   `../src/lib/*` (ESM, outside the Vite root, `server.fs.allow` or alias)
   and that the resulting bundle carries no Node-only code. Prove it with a
   throwaway build that imports `approval-page.js`'s siblings, then delete
   the throwaway.
5. Enumerate the approval endpoint's distinct response shapes from
   `src/lib/approval-page.js` and its test fixtures: bridge present, bridge
   absent (stated absence), bridge non-reconciling, unexplained residual,
   unassigned keys, missing cost basis in use, missing cost basis not in use,
   empty notRecorded, version absent. This enumeration seeds the Phase 3 test
   fixtures, and per Verification 47 those fixtures are built the way the
   SYSTEM produces the state: through the lib functions and their real
   inputs, never hand-shaped to what the React components read.
6. Report Node and npm versions available in CI (GitHub Actions) and on
   Render against Vite's requirements.

Phase 0 output: a numbered report against these six items. Discrepancies stop
the round.

---

## Phase 1: the Vite shell

**Structure.** New `frontend-react/` workspace at the repo root. Vite +
React + TypeScript. `src/lib` remains plain JS and is imported across the
boundary untouched; TS config treats it as JS with checking off for that path.

**Build output** to `frontend-react/dist`, served by a second
`@fastify/static` registration (`decorateReply: false`) at `/app/` prefix.
API routes keep priority. The `onSend` hook covers the new prefix per Phase 0
item 1.

**Mounting model.** The vanilla `app.js` remains the shell and router. The
React bundle is loaded by one script tag in `index.html` and does exactly one
thing this round: it registers `window.loadApprovalPage`, mounting a React
root into the existing `#view-opportunity-approval` container when called.
The vanilla `opportunity-approval.js` script tag is removed in the same
commit. View id, `ALL_VIEWS` membership, and the back button's markup are
unchanged, so `transition-requests.test.mjs`'s ALL_VIEWS assertion holds
without edits.

**The shell-services seam.** One module, `shell-services.ts`, is the only
place `window.*` is read:

```
api(method, path, body)      -> window.api
navigate(view, id)           -> window.navigate
detailLoaded(view)           -> window.detailLoaded
getOppLoadedRevision()       -> window.getOppLoadedRevision
```

Components receive these via context. No component reaches for `window`. This
seam is a permanent deliverable: every subsequent surface mounts through it.

**Query layer.** TanStack Query is introduced here, with the
approval-page query as its first and only entry. Conventions set in this
round and recorded in `DESIGN_PRINCIPLES.md` at round close: one query key
scheme (`['opportunity', id, 'approval-page']`), invalidate-after-mutation as
the only refresh mechanism, `isError` rendered, never swallowed. The five
Round 41 defects the query layer prevents by construction are the reason it
enters at the cheapest possible surface rather than under Commercials' load.

**Dev workflow.** Build-watch (`vite build --watch`) served by Fastify
on one origin. No dev-server proxy in the pilot: headers and auth stay
identical to production. Revisit before Commercials.

**Revert procedure, written before the work.** Restore the
`opportunity-approval.js` script tag, remove the bundle script tag, in one
commit. Nothing else changes, because nothing else is allowed to depend on
the React tree this round. The procedure is rehearsed in Phase 5, not merely
written down.

> **REHEARSED 2026-09-05, AND THE PROCEDURE ABOVE IS INCOMPLETE BY ONE EDIT.**
> Executed on a branch, it works: the vanilla view renders in full against the
> real server, all five blocks filled, zero React markers, the bundle never
> requested, and the tree was byte-identical afterwards.
>
> **But the gate goes red**, 1 of 19 stages, on `commercials-wiring.test.mjs`'s
> assertion *"the vanilla approval view is unloaded; a live script tag would
> make the dead file live again"*.
>
> **That failure is the assertion doing exactly its job**, and it must not be
> softened: it exists to catch a live tag on the file the migration unloaded,
> and a revert is a live tag on that file, on purpose.
>
> **So the revert is TWO edits in one commit**, and the second is: invert that
> assertion to "is loaded", and drop the React consumer from the `ds-row` check
> beside it.
>
> Everything else held. **Both React stages still PASS on the reverted state** -
> the suite and the bundle-freshness check - which is correct rather than a
> hole: the React source is still in the repository and still builds, it is
> simply not served. Nothing in the gate exists only to be deleted on a revert.
>
> **This is what a rehearsal is for.** The procedure read as complete to both
> parties and was one line short, and the only way to find that was to run it.

---

## Phase 2: the approval view, migrated

The vanilla file's header comments are requirements, not history. The
migrated view must satisfy all of the following, and this list is the
verification basis (derived from rendered behaviour, not from the JS source):

1. **Nothing computed client-side.** One fetch, five rendered blocks. Any
   arithmetic beyond formatting is a defect.
2. **Defaults render as value plus provenance**, never a blank, never a bare
   figure. This page shows what DID happen.
3. **The staleness sentence.** `priced at revision N`, and when
   `getOppLoadedRevision()` returns a higher integer, the sentence extends:
   `the record has since moved to revision K, so reload before deciding`.
4. **`detailLoaded('opportunity-approval')` fires on every exit path**,
   success and failure alike (Round 41 item K: the view stops hiding its
   body). In React terms: fired from the mount lifecycle after first render
   settles, error or not.
5. **Error state**: a failed fetch renders the server's error sentence in the
   error slot; the five blocks do not render stale content.
6. **The bridge's honesty states are preserved exactly, and there are four**:
   reconciling, with display rounding stated as rounding; NOT reconciling,
   rendered as an error telling the approver not to rely on the figures; an
   unexplained residual, rendered as its own error; and NOT COMPARABLE
   (baseline present but carrying no cost basis), rendered as the caveat that
   this is not a comparison of two priced deals and must not be read as one. A
   bridge that always adds up is telling an approver nothing.
7. **Stated absence, not a gap**: no baseline renders the absence sentence,
   never an empty block.
8. **Missing cost basis in use renders the zero-cost warning** with the unit
   count; not in use renders the not-affected note.
9. **The change-note cap**: three named changes, then a count, full list in
   the title attribute.
10. **Opening and closing rows frame the bridge** with the rule above the
    closing row (the `appr-frame` treatment).
11. **Escaping**: React's default escaping replaces `esc()`. No
    `dangerouslySetInnerHTML` anywhere in this view. Where the vanilla view
    interleaved markup in strings, the React view composes elements.
12. **Back button** navigates to `opportunity-detail` with the loaded id.

Visual parity: same stylesheet, same class names where they carry rules
(`ds-row`, `pg-item-note`, `msg-error`, `msg-warning`, `tag`, `appr-frame`).
This round does not restyle. Pixel-identical is the default here because
nothing prevents it; any demonstrable exception is reported, not absorbed.

---

## Phase 3: tests for the pilot, re-derived

1. **Component tests for the approval view** written from the twelve-point
   list above and from Phase 0 item 5's enumeration of endpoint shapes. Not
   from the components. Not from the vanilla source. Fixtures are produced
   through `src/lib/approval-page.js` with system-shaped inputs
   (Verification 47), so a fixture the application could not produce cannot
   exist in this suite. Fixtures cover all thirteen shapes in
   `MIGRATION_ROUND_1_PHASE_0_REPORT.md` item 5, which supersedes this brief's
   seed list.
2. **The `ds-row` assertion in `commercials-wiring.test.mjs` is re-pointed**
   at the React source (or replaced with a rendered check), in the same
   commit that unloads the vanilla file. Left as is, it would pass against
   dead code: the false-completion-signal pattern, and the first of the 106
   rewritten deliberately as the template for the rest.
3. **A shell test**: `loadApprovalPage` registered, mounts into the existing
   container, `detailLoaded` fires on success and on a failing fetch.

---

## Phase 4: the field-row component

Built from `MIGRATION_FIELD_ROW_CONTRACT.md` and nothing else. All seven
behaviours; tests derived from the contract document, per its own closing
warning. Ships unconsumed: no production surface uses it until Round 2.

- One guarded edit-entry hook carries the ownership door (behaviour 2). The
  guard is a function injected via the seam, not a `getElementById` read
  inside the component, so the React tree does not couple to the vanilla
  DOM's ownership class. Phase 0 of Round 2 decides what the injected guard
  reads once the consuming surface is known.
- Dirty is computed (`draft !== orig`), never a flag (behaviour 1).
- Display and edit swap by visibility, never removal (behaviour 3).
- `tabindex="0"`, keydown opener, and the seed character is kept (behaviour 4).
- Discard restores the original; discard is not close (behaviour 5).
- The edit bar is a surface-level component aggregating across rows; the row
  cannot own it (behaviour 6).
- The read-only variant is the same row without a door and without a tab
  stop, not a disabled editable row (behaviour 7).
- The numeric guard's `inputmode` keying is honoured at the interface: the
  row accepts field descriptors that declare what they take. Field-specific
  editors remain out of scope per the contract.

---

## Phase 5: revert rehearsal and close-out

1. On a branch, execute the written revert procedure. Verify the vanilla
   approval view renders and `npm test` passes. Discard the branch. The
   revert is now a rehearsed fact, not a claim.
2. `npm test` and the DB suite green on the migrated state.
3. A walk of the approval view on a real record in each endpoint state
   reachable in the sandbox, against the twelve-point list.
4. `CURRENT_STATE.md` regenerated and committed.
5. Round report: what held, what surprised, and explicitly whether the tests
   were re-derived cleanly or whether the contract documents needed
   amendment, because that answer is the Round 2 entry evidence.

---

## Exit gate for Round 2 (Commercials)

All three, confirmed by John, not inferred from the work feeling substantial:

1. The approval view passed its twelve-point walk and the revert was
   rehearsed successfully.
2. The field-row component satisfies all seven contract behaviours in tests
   derived from the contract document.
3. The re-derivation discipline held: no test in this round was written from
   a component or from the vanilla source, and the one re-pointed assertion
   is the recorded template for the remaining 105.
