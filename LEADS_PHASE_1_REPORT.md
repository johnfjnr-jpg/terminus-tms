# Leads, P1: the lifecycle logic

**Nothing pushed.** P1 is logic and its proof; nothing here reaches a screen.

**Two items are NOT complete and they are named first**, per build discipline
15: item 1's code half, and item 3's proof. Both are blocked on the same
unapplied migration, and neither is blocked on anything I can do.

---

## NOT COMPLETE

### Item 1, the code half: two one-line sites, held for Phase 1b

The migration is **written and unapplied** (`20260911000001_contact_nurture_relabel.sql`).
Until John applies it, the database knows `Parked` and not `Nurture`, so
changing these two sites now would break the live screen:

| site | today |
|---|---|
| `ContactHost.tsx:257` | POSTs `to_stage: 'Parked'` |
| `ContactPanel.tsx:111` | renders `'Parked lead'` |

**Held deliberately, not overlooked.** Landing them before the apply produces a
client that asks for a stage the server does not have.

### Item 3, the Nurture gate proof: blocked, and the block IS the finding

`Unqualified -> Nurture` **cannot be reached at all today**:

```
400 "cannot skip stages: Parked is not the next stage after Unqualified"
```

Nurture is `sort_order` 3 and Qualified is 2, so the adjacency check in
`transitions.js` refuses the jump, **and the `followUpDate` gate beneath it is
dead code.** That is `RECORD_CREATION_ATOMICITY_BRIEF.md` R4c measured live
rather than inferred - the carried item R2 absorbed, confirmed.

**The fix is in the same migration** and is a configuration correction rather
than a build: `reachable_from_any_stage`, the estate's existing side-branch
mechanism, **already carried by `opportunity/'Closed Lost'`**. `transitions.js`
says why it is the right one - it "widens which stages may be entered from
here, not what is required to enter them" - so the `followUpDate` requirement
is untouched and must still be satisfied.

**The proof re-runs unchanged after the apply.** The probe **reads** the stage
name from `stage_definitions` rather than typing it, so it is correct on both
sides and prints which side it is on. No Phase 1b rewrite.

---

## What existed versus what was built

| item | verdict |
|---|---|
| 1. Relabel | **migration written, unapplied**; 2 code sites held |
| 2. Qualify enforcement | **existed** - 14 gate rules. **Proven.** |
| 3. Nurture gate | **existed but unreachable.** Fix written; proof blocked |
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
FAIL  Contact Details incomplete -> Qualified LANDS 200          <- finding
FAIL  no followUpDate -> Nurture REFUSED                          <- blocked
FAIL  followUpDate present -> Nurture LANDS                       <- blocked
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
- **The Nurture gate is unproven until the migration applies.** The probe is
  written and re-runs unchanged.
- **`company`'s status is a finding, not a decision.**
- **No live-DOM verification was needed**: no P1 change reached a surface, so
  the standing qualification was not exercised.
- The P3-P5 mockups are still absent.
