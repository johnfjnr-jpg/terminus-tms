# Round 7 Phase 2d, session 3: the rest, and the enumeration reaches zero

**Precondition:** session 2 committed at `f356e9a`, 21-stage gate green, the
`app.js` enumeration asserting 7 names / 123 lines.

**No swap.** The vanilla Test Bed is still live.

---

## The enumeration, before and after

| | names with no React counterpart | vanilla lines |
|---|---|---|
| **before** | 7 | 123 |
| **after** | **0** | **0** |

**BOTH POPULATIONS NOW READ ZERO.** The file population has read 20 of 20
rendered since Phase 2b; the view population reached zero here. Phase 2c exists
because the first said *takeable* while the second had never been asked.

Both gates are inverted: they assert the floor and fail if anything falls below
it.

---

## A DEFECT THIS ROUND INTRODUCED, found by reading the vanilla for this session

**Session 1 wired the documents panel to two routes that do not exist.**

| session 1 wrote | the route |
|---|---|
| `POST /test-beds/:id/documents/confirm` | `POST /test-beds/:id/complete-document` |
| `PATCH /test-beds/:id/documents` | the same route, with `approve: false` |

**Nothing failed.** No test exercised the call, and the panel's own assertions
are about what it renders. Verification 47 from the caller's side: a request
shaped by what the reader wanted rather than by what the route takes. Corrected
here, and an injection now fires if the invented route returns.

---

## C: the document write, and `approve` is the whole point

**`approve` defaults to TRUE on the server so every pre-existing caller behaves
as it did**, and a URL save must pass `false` explicitly.

**The reason is a gate bypass, recorded at the route.** `status` was a
hardcoded, unconditional `'approved'`, so saving a URL approved the document as
a side effect. The URL points at the **working copy**, set while the document is
still being written, and **satisfying a gate by pasting a link is precisely the
failure the gate exists to prevent.**

**Three injections cover it in both directions**: a save that passes `true`, a
save that omits the key, and a confirm that starts passing `false` so nothing
ever approves. All three fire.

**C3 has a second edge worth naming.** A confirm carries whatever is in the URL
box, and **omits the key entirely when the box is empty** rather than sending
`''` and clearing a stored URL.

---

## X: the convert path, measured before building

**Item 1's requirement. The estate's first cross-record write from a migrated
surface.**

**Reads** six things: the Test Bed record, the conversion criteria, prior
conversions, the Test Bed's latest revision, the Qualification probability
default, and the system defaults.

**Creates three rows** - a `records` row, a `record_revisions` row at number 1,
and an `opportunity_details` row - plus two audit entries. **Two fields are
genuine renames rather than copies**: `client_organisation` becomes
`company_name`, `initialLead` becomes `customerLead`.

**Writes NOTHING back to the Test Bed.** The only trace on the source is an
audit row. **The link lives on the TARGET**, in
`opportunity_details.converted_from_test_bed_id`, which is also what the
max-conversions check reads.

### THE FAILURE BEHAVIOUR IS THE FINDING: there is no transaction

The three inserts are separate statements with a return between each, so:

| fails at | left behind |
|---|---|
| `records` | nothing |
| `record_revisions` | an Opportunity with **no revision** |
| `opportunity_details` | an Opportunity with a revision, **no details row, and no link back** |

**The third is the one that matters for the gate.** With no
`converted_from_test_bed_id` the max-conversions check cannot see the
conversion, so **a second conversion is permitted.** The route's own comment
records that this check once returned zero silently from an unchecked error, and
a second conversion went through.

**Recorded, not fixed: it is a server change and this session is the client.**
Rule 10, on the list.

### 2E OWES THIS PATH AN END-TO-END LIVE WALK

Create from a real Test Bed; assert the Opportunity exists with its two mapped
fields; assert the `opportunity_details` link row; attempt a second conversion
and see it refused. **Flagged here as the report requires.**

---

## No dead-code refusals, and that is a measured answer

**Two names looked like candidates and neither is dead.**

`applyConfirmedApproval` is an optimistic DOM mutation the vanilla really
calls - it is **superseded by rendering**, not dead, and its disposition says so.
**It also has a gap the React version does not**: it locates the row by matching
`.sa-approval-role` text against the track name, and a version-scoped row's
label is `<track> - Proposal/Pricing approved for issue`, which does not match
its own track. In the vanilla the optimistic update silently does nothing there.

`wireTestBedConvertOnce` guards against double-wiring static markup. A component
has no such problem, so **the absence is the migration**, not a deletion.

**Nothing was proposed as dead, so nothing needed sandbox-deletion evidence.**
The bar was not lowered; it was not reached.

---

## F: the stage refresh, and a divergence recorded rather than hidden

The vanilla's `refreshTbStagePanels` reloads documents and exit criteria and
**not** approvals - deliberate scoping, since a document confirmation cannot
change an approval.

**The React version re-runs the whole stage load, and that is a recorded
divergence.** There is ONE loader and one path (Architecture 3); a second
partial one would agree with it today and drift later. The cost is one extra GET
on a panel that has not changed.

**A guard inside it was measured redundant and removed.** The effect checked
`!isStageTab(lastTab.current)`, and its injection came back **SILENT with zero
failures** because `activate` already returns before any fetch for a non-stage
tab. Verification 9's signature for a guard whose removal changes nothing:
**dead or redundant, and both are worse than absent** because they suggest a
protection that is not working.

---

## Calibration

`scripts/round7/inject-phase-2d-s3.mjs`, using session 2's hardened harness
verbatim. **16/16 detected, reverted run GREEN, all four files byte-identical.**

The 2c view gate was re-pointed to its inverted form and re-run: **6/6.**

### THE HARDENED HARNESS EARNED ITS KEEP ON ITS FIRST OUTING

The first run hit an injection that hangs - an effect with no dependency array,
which re-runs on every render - and **stopped dead rather than scoring it**:

```
STOP: "F1: the effect watches every render, so each one refetches"
      produced NO PARSEABLE RESULT in 20032ms.
  Neither DETECTED nor SILENT is knowable. Restoring and stopping.
```

**That is exactly the failure that destroyed session 2's work**, caught by the
control session 2 added in response. The file was restored and the run ended
cleanly; declaring `expectHang` on that injection made the timeout its evidence.

---

## Standing detectors

| detector | result |
|---|---|
| accounting (both populations) | 12/12 |
| duplicate ids | 3/3 |
| computed visibility | 2/2 |
| casing collisions | 2/2 |

---

## Surprises

**1. An unused import passed the typecheck.** Session 3's first host edit landed
its imports and its route corrections but **not the `<ConvertPanel/>` render** -
a `replace` whose anchor session 2 had changed. `ConvertPanel` and
`CONVERT_ROUTE` sat imported and unused, and `tsc --noEmit` said nothing. Found
by grepping for the call site rather than by any check.

**2. Inverting a gate can make its companion vacuous.** With `VIEW_GAPS` empty,
*every declared view name still exists in app.js* iterated an empty list and
asserted nothing - Verification 14. It now reads the enumeration's own names, of
which there are fifty-odd, with a vacuity guard on the count.

**3. The convert route's partial-write window is the kind of finding a client
migration is well placed to see and badly placed to fix.** Reading it closely
enough to port the client is what surfaced it.

---

## Gate

**All 21 stages passed.** Pure 485/485, database 94/94, react **876/876**, all 0
fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The react suite grew by 25 this session (851 to 876).

**Not pushed. No swap. PHASE 2E IS NOW REACHABLE**: both populations read zero
and both gates assert their floor.
