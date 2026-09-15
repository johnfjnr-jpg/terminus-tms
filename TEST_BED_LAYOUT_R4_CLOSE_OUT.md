# Test Bed layout, partial close: R4 only

**CLOSED ON R4 ALONE.** Gate **24 of 24, exit 0** on `cc5ca46`. React
**1009/1009**. **R1, R2 and R3 carry - they were not built, and that is the
round's shape rather than a shortfall.**

**NO SERVER RESTART**: `src/` is **0 files** across both commits. The change is
`frontend-react/src/testbed/TestBedHost.tsx` and its bundle.

**PUSHED** on the word, 2026-09-15. `ls-remote` confirms `origin/main` = local
HEAD = `56d894648eea9449fe50fe917dedba6ce0dac6c1`.

---

## Reconciliation by counting

| commit | what |
|---|---|
| `767e0a3` | the brief |
| `cc5ca46` | **R4**, built and proven |

**Two commits, two accounted.** R1/R2/R3 have **no commit, correctly** - they
were scoped and deliberately not started.

## R4: two stacked faults, and either one alone hid the other

**1. THE WRONG KEY.** `GET /api/test-beds` answers `account_id` and
`account_name` as **flat columns** and never an `account` object, so
`record.account?.id` was `undefined` on **10 of 10 live beds** and the effect
returned before fetching anything.

> **Verification 20 at its sharpest.** Line 389 of **the same file** already
> read `record.account_id ?? record.account?.id`. The correct reader was four
> hundred lines away the whole time.

**2. THE ROUTE DOES NOT EXIST.** `GET /api/accounts/:id/contacts` answers
**404** and is declared nowhere in `src/routes`. **Fixing the key alone would
have left the dropdown empty and LOOKING fixed** - Verification 47's clause, a
request shaped by what the reader wanted.

**TWO CALLERS used that dead route, not the one that was reported**: the buyer
lookups and the tech-team picker. Verification 41's enumeration - a fabricated
route is found by listing its callers. Both re-pointed at `GET /api/contacts`
filtered by `parent_record_id`, **the one source Round B established for this
question**, so no new endpoint and no server change.

**Proven by CLICKING the control:**

```
{"field":"buyer-Client Commercial Buyer","isSelect":true,"optionCount":3,
 "options":["--","tbr4 Buyer Two","tbr4 Buyer One"]}
```

**Three options where there was one**, and the two are the account's real
contacts.

## THE REPORTED SYMPTOM WAS NOT THE ACTUAL ONE

R4 was ruled as *"account picker button-spray -> proper dropdown menu"*.
**Measured, the control was already a `<select>` carrying one empty option.**
Button-spray was the **Qualify `AccountPicker`**, fixed in an earlier round.

> **The fault was the DATA, not the control**, so "reuse the contact-screen
> picker's dropdown treatment" had nothing to reuse. Recorded because building
> to the description rather than the measurement would have replaced a working
> control and left the dropdown empty.

---

## Carried, with what the scoping found

1. **R1 - Test Bed layout move.** Summary / Notes / Follow-up to the header.
   **Pure layout**: Test Bed already has the clean notes/audit split.
2. **R2 - Key Dates beside Site Details.**
3. **R3 - Sensor Counts and Costs to the Commercials tab. THE CAUSE IS ONE
   LINE**: `TestBedHost.tsx:526` passes **`commercials={null}`** into the slot
   `StageTabs.tsx:211` renders. It is a slot-fill plus moving two Cards, and
   **the 9 static cards in `index.html`'s `#tb-tab-commercials` are DEAD
   markup** that never renders.
   > **DESIGN, flagged before it is built**: moving those Cards out of
   > `TestBedPanel` takes them away from its single `useFieldRows` draft store.
   > A second panel means a **SECOND draft store - two editors of one record**,
   > which is the stale-state family. **The A4 portal pattern avoids it** and
   > keeps one store, unless John prefers otherwise.
4. **The leads/contacts notes/audit split** - its own round. Server write-path
   (structured audit into `audit_log.detail` on PATCH) plus a display renderer
   that composes the sentence. **Architecture 12**: a definer derives audit, it
   does not accept client-composed audit. **`src/` change, so restart
   discipline applies.** The 20 existing mixed entries were ruled
   leave-going-forward; **reconfirm at that round's open, because the shape
   changed after the ruling was given.**
5. `StageActions` outside the conformance gate · the two unstyled buttons ·
   **(d)** unscoped · ENFORCEMENT GAPS carrieds · navigation-state survival ·
   item 5's teardown population dependency · the Commercials tab not switching
   under a probe.

**This close-out is markdown with no gate reader and rides the green gate at
`cc5ca46` under build-discipline 48(a).**
