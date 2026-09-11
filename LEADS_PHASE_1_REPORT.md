# Leads, P1: the lifecycle logic

**Nothing pushed.** P1 is logic and its proof; nothing here reaches a screen.

**Two items are NOT complete and they are named first**, per build discipline
15: item 1's code half, and item 3's proof. Both are blocked on the same
unapplied migration, and neither is blocked on anything I can do.

---

## COMPLETED AFTER THE APPLY, 2026-09-11

**Both items that were blocked are now done.** John applied the migration
through the Supabase SQL editor, which is this repo's actual practice - my
first instruction named `npm run db:push` and was wrong for it.

**Verified independently over PostgREST, not taken on report:**

```
stage_definitions   Unqualified 1 false | Qualified 2 false | Nurture 3 TRUE
gate rule           Unqualified -> Nurture  payload_field_required followUpDate
still named Parked  stage_definitions 0, gate_rules 0, records 0, defaults 0
relabelled          6 records now Nurture (the soft-deleted six)
```

### R2's carried item is CLOSED

The lifecycle probe went **5/8 to 7/8**, and the two that moved are exactly
what the prior ruling required:

```
PASS  no followUpDate      -> Nurture REFUSED 422, naming followUpDate
PASS  followUpDate present -> Nurture LANDS 200, record now Nurture
```

**The probe needed no rewrite.** It reads the stage name from
`stage_definitions` rather than typing it, so the same file ran on both sides
of the apply and printed which side it was on.

### Item 1's code half: 2 sites, 0 `Parked` literals left

**And the live-DOM check earned its place twice**, which is why the instruction
required it instead of the suites.

**The react suite passed 932/932 with the string changed.** Had anything
asserted `"Parked lead"`, flipping it would have gone red. Nothing did - so the
label is **unasserted**, and the suite is not evidence about it either way.

**And this would have shipped:** the first live-DOM run showed the screen still
rendering the OLD label while source, typecheck and 932 tests were all green.
**The served bundle is a second reader of the source and had not been rebuilt.**
`check-dist-fresh.mjs` exists for exactly this and says so in its own comment.

A third correction was the **instrument**: the assertion tested `/Nurture lead/`
and failed against a correct screen, because the element is CSS
`text-transform: uppercase` and `innerText` returns the **transformed** text.
An assertion about what a person SEES matches what is rendered.

Both halves asserted: `Nurture lead` present **and** `Parked` absent.
Screenshot read: **NURTURE LEAD** with a NURTURE badge, notes header **LATEST
FIRST**.

---

## What existed versus what was built## What existed versus what was built

| item | verdict |
|---|---|
| 1. Relabel | **COMPLETE** - migration applied, 2 code sites landed, live-DOM verified |
| 2. Qualify enforcement | **existed** - 14 gate rules. **Proven.** |
| 3. Nurture gate | **existed but unreachable.** Fixed and **PROVEN both directions** |
| 4. Reason-as-note | **ALREADY BUILT.** Proven, not built |
| 5. Follow-up task | **built** - one key. Proven, calibrated 2/2 |
| 6. Notes model | **largely existed.** Gaps below |

**Item 4 needed no build at all.** `ContactHost.tsx` already writes the park
reason as a prepended note before transitioning, and its own comment says why
the order matters: *"the reason is already recorded, which is why the note is
written first."*

---

## The transition proofs, both directions

Over HTTP, as real users. **The identity counterfactual is a second real JWT**
(`john+test2@`), never the service role.

```
PASS  Address incomplete    -> Qualified REFUSED 422, naming city
PASS  Summary incomplete    -> Qualified REFUSED 422, naming summary
PASS  all three complete    -> Qualified LANDS 200, record moves
PASS  complete, NON-OWNER   -> REFUSED 403 ownership-shaped, record does not move
PASS  the hold reason       -> recorded as a NOTE, newest first, no separate field
PASS  no followUpDate       -> Nurture REFUSED 422, naming followUpDate
PASS  followUpDate present  -> Nurture LANDS 200, record now Nurture
FAIL  Contact Details incomplete -> Qualified LANDS 200          <- the one finding
```

**The refusal is asserted to be ownership-SHAPED, not merely a 4xx.** A
body-shape or gate refusal would satisfy a naive check and prove nothing.

### The completeness cases, and why they are shaped this way

**Derived from the ruled model, never from the rule rows** - the instruction's
requirement and Verification 47's: a probe that read the 14 gate rows and
asserted them back would pass against **any** set of rows, including a wrong
one. The groups are the **screen's own cards**: Contact Details, Address,
Summary - the model as a person meets it.

**One representative field is cleared per group**, not the whole group, for two
reasons. It is the sharper test - the gate must fire on a **single** missing
field. And `mobile` cannot be cleared at all, because `PATCH /contacts`
validates it, so clearing the whole group is refused by the **validator** before
the gate is reached: a refusal for the wrong reason.

**The fixture creates complete and then clears**, because `POST /contacts` has
its own mandatory minimum (`company`, `email`, `mobile`, `source`) and the
incomplete state **cannot be reached at creation**. It is reachable by a person
clearing a field afterwards, which is the path built.

### FINDING: `company` is in the Contact Details card and is NOT gated

Clear it, ask for Qualified, and it returns **200**. The ruled model says
Contact Details must be complete; the enforcement does not require `company`.

*`industry` looked like a second case and is not: the card shows `industry` and
the gate reads the `industry_id` column - the same thing under two names.*

**One field, and whether it closes is a ruling, not a fix.**

---

## Item 5: the follow-up task

**One key added, not a new mechanism.** `followUpDate` was already writable on
any status; there was nowhere to say **what** the follow-up is. Both are
ordinary payload fields on the ordinary write path, **so they are writable on
every status by construction** rather than by a rule that must be kept in step
with the status list.

```
PASS  writable on Unqualified, with a description, and reads back
PASS  writing a follow-up task adds NO note: the task is not the Nurture reason
PASS  the same task is writable on Qualified
PASS  the description can be CLEARED and stays cleared
PASS  an unknown payload key is still REFUSED
```

The fourth is Architecture 11 - a cleared field is a state the record must be
able to **say**. The fifth is case one's counterfactual.

**Calibrated 2/2, reverted green, `contacts.js` byte-identical**, with the
server restarted around **every** injection: it runs without `--watch`, so an
injection not followed by a restart is measured against the code it replaced
**and comes back green**.

**The second injection had to be rewritten.** The first added a stray key to
the allowlist, which does not make a write append a note, so the assertion
could not fail and read SILENT. Verification 51's caveat - **the harness was
wrong, not the detector.**

---

## Item 6: the notes model against the ruled spec

| ruled | today | |
|---|---|---|
| timestamped | `note(text, by, at)`, `at` injected so a test is not hostage to the clock | **MATCHES** |
| newest first | `prepend` = `[n, ...existing]`, commented "LATEST FIRST, and never truncated" | **MATCHES** |
| Add Note appends as the latest | same `prepend`, one writer | **MATCHES** |
| **default last 2** | `notes.map(...)` with **no slice** - every note renders | **GAP** |
| **expand to 10 or All** | no control exists | **GAP** |

**Both gaps are display, so they are P2/P3 by the instruction's own boundary,
not P1.** The model underneath is correct and needs nothing.

**One measured correction to the code's own comment:** `prepend` says "three
callers". There are **four** - three in `ContactHost` (field edits, manual note,
park note) and one in `TestBedHost`. Three is right for Contact and the fourth
is a reuse. Recorded because a census trusting the comment would report the
wrong population.

---

## The relabel's blast radius

Measured, exact counts:

| | |
|---|---|
| `stage_definitions` rows named `Parked` | **1** (`contact` only) |
| `stage_gate_rules` with `to_stage` Parked | **1** |
| `stage_gate_rules` with `from_stage` Parked | **0** |
| `records` with status Parked, **live** | **0** |
| `records` with status Parked, incl. deleted | **6** |
| `stage_probability_defaults` | **0** |
| code sites, comment-stripped | **2**, both React |

**The soft-deleted six are relabelled anyway**: a status no longer in
`stage_definitions` is an orphan, and a restored record carrying one could not
transition. **`from_stage` is swept though it matches nothing**, so a rule
written later is not missed by a migration that only looked where rows happened
to be.

**The migration carries no self-recording ledger row** (Architecture 10 as
corrected), and rule 14(a) is satisfied by construction rather than by care:
six plain `UPDATE`s, **zero `UPDATE ... FROM`**, nothing that can scope wrongly.
**This session cannot parse-check it** - PostgREST only - and saying so is part
of handing it over.

Its self-check asserts **both directions**: no row still names Parked, **and**
Nurture exists, **and** the `followUpDate` gate followed the relabel onto it,
**and** Nurture is reachable. Absence alone is satisfied by the thing never
having existed.

---

## Two corrections to my own Phase 0 report

1. **"Email and mobile have no validation" was half wrong.** **Mobile is
   validated server-side on both write paths** (`isValidMobile`). The probe
   found it by being refused. My Phase 0 grep searched `valid|pattern|email`,
   the validator is named `isValidMobile` with the message "must be a phone
   number", and I read the empty result as absence **without calibrating it** -
   Verification 12, in my own census. Email is presence-only, which the original
   got right.
2. **The P1 instruction first arrived truncated**, mid-item-5. I completed item
   5 from the brief's design of record and **stopped rather than assume the list
   ended**. The full instruction carried an **item 6**, which I did not have.
   Stopping was right.

---

## What P1 does NOT establish

- **Nothing about any screen.** The disabled Qualify hint, the list and the
  detail rendering are P2/P3 by the instruction's boundary.
- **`company`'s status is a finding, not a decision.**
- **The live-DOM check covered the relabel only.** No other P1 change reaches a
  surface.
- The P3-P5 mockups are still absent.
