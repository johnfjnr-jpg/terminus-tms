# Leads, P1: final report

**P1 is complete. 8/8 proven. Nothing pushed.** 10 commits.

Two migrations were written here and applied by John through the Supabase SQL
editor; both were verified independently over PostgREST rather than taken on
report.

---

## 1. Existed versus built, final

> **P1 was extend-and-prove, as ruled. Two of the six items needed no build at
> all, and a third was one key.**

| item | verdict | |
|---|---|---|
| **1. Relabel Parked -> Nurture** | **BUILT** | migration + 2 code sites; live-DOM verified |
| **2. Qualify enforcement** | **EXISTED** | 14 gate rules. Proven. R5 made it 15 |
| **3. Nurture gate** | **EXISTED, UNREACHABLE** | fixed by configuration; proven both ways |
| **4. Reason-as-note** | **ALREADY BUILT** | proven, not built |
| **5. Follow-up task** | **BUILT** | one payload key; proven, calibrated 2/2 |
| **6. Notes model** | **EXISTED** | model correct; two display gaps |

**Item 4 needed nothing.** `ContactHost` already wrote the reason as a prepended
note before transitioning, and its own comment says why the order matters:
*"the reason is already recorded, which is why the note is written first."*

**Item 3's fix was configuration, not code.** `reachable_from_any_stage` is the
estate's existing side-branch mechanism, already carried by
`opportunity/'Closed Lost'`, and `transitions.js` says why it is the right one:
it *"widens which stages may be entered from here, not what is required to
enter them"* - so the `followUpDate` requirement survived untouched.

---

## 2. The transition proofs, both directions

Over HTTP, as real users. **The identity counterfactual is a second real JWT**
(`john+test2@`), **never the service role**.

```
PASS  Contact Details incomplete -> Qualified REFUSED 422, naming company
PASS  Address incomplete         -> Qualified REFUSED 422, naming city
PASS  Summary incomplete         -> Qualified REFUSED 422, naming summary
PASS  all three groups complete  -> Qualified LANDS 200, record moves
PASS  complete, NON-OWNER        -> REFUSED 403 ownership-shaped, record unmoved
PASS  no followUpDate            -> Nurture REFUSED 422, naming followUpDate
PASS  followUpDate present       -> Nurture LANDS 200, record now Nurture
PASS  the hold reason            -> a NOTE, newest first, no separate field
                                                                     8/8
```

**The refusals are asserted to be the RIGHT SHAPE, not merely 4xx.** The
ownership case asserts ownership-shaped; the completeness cases assert the
refusal names the specific field cleared. A body-shape refusal would satisfy a
naive check and prove nothing.

### The completeness cases, named

**Derived from the ruled model, never from the rule rows** - the instruction's
requirement and Verification 47's. A probe that read the gate rows and asserted
them back would pass against **any** set of rows, including a wrong one. The
groups are the **screen's own cards**, the model as a person meets it:

| group | cleared to make it incomplete | refusal |
|---|---|---|
| **Contact Details** | `company` | 422 naming `company` **(R5)** |
| **Address** | `city` | 422 naming `city` |
| **Summary** | `summary` | 422 naming `summary` |

**One representative field per group, not the whole group.** It is the sharper
test - the gate must fire on a **single** missing field - and `mobile` cannot
be cleared at all, so clearing the whole Contact Details group is refused by
the **validator** before the gate is reached: a refusal for the wrong reason.

**The fixture creates complete and then clears**, because `POST /contacts` has
its own mandatory minimum and the incomplete state **cannot be reached at
creation**. It is reachable by a person clearing a field, which is the path
built.

**R5 closed the one finding, and the probe ran unchanged to prove it** - it
reads the gate from data, so adding a rule made the existing case start passing
rather than needing a new one.

### A mapping surfaced by R5, recorded so it is not read as a duplicate

`20260812000005`'s own header says it mapped the prototype's **"company" onto
`parent_record_id`** and "industry" onto `industry_id`. So the gate already
carried a requirement its author recorded **as** company. It now requires
**both**: the Account link, and the typed Company field. Different facts about
a lead. John had this before applying.

---

## 3. The notes model, and its gaps

| ruled | today | |
|---|---|---|
| timestamped | `note(text, by, at)`, `at` injected so a test is not hostage to the clock | **MATCHES** |
| newest first | `prepend` = `[n, ...existing]`, "LATEST FIRST, and never truncated" | **MATCHES** |
| Add Note appends as the latest | the same `prepend`, one writer | **MATCHES** |
| **default last 2** | `notes.map(...)`, **no slice** - every note renders | **GAP** |
| **expand to 10 or All** | no control exists | **GAP** |

> **Both gaps are DISPLAY, so both are carried to P2/P3** by the instruction's
> own boundary. The model underneath is correct and needs nothing.

The screenshot confirms the model on screen: the notes header reads
**"NOTES HISTORY · LATEST FIRST"**.

**One measured correction to the code's own comment:** `prepend` says "three
callers". There are **four** - three in `ContactHost` and one in `TestBedHost`.
Three is right for Contact; the fourth is a reuse. Recorded because a census
trusting the comment would report the wrong population.

---

## 4. The two Phase 0 corrections, standing

Both remain corrected in the Phase 0 report with the superseded claims visible.

| | |
|---|---|
| **mobile** | **VALIDATED SERVER-SIDE on both write paths** by `isValidMobile` (`contacts.js:176`, `:316`). My Phase 0 report said it was not. |
| **email** | **presence only** (`!email?.trim()`), no format check. The original got this right. |

**How the wrong finding was reached matters more than the correction.** The
Phase 0 scan grepped for `valid|pattern|email`; the validator is named
`isValidMobile` with the message "must be a phone number", and **the empty
result was read as absence without being calibrated** - Verification 12, in my
own census.

**The consequence for P5:** the client half is a build for **both** fields;
the server half is a build for **email only**, and P5 **must not add a second
mobile validator** beside the existing one (Verification 20).

---

## 5. Bundle freshness: required verification for every screen phase

**Recorded in the brief**, where P2-P5 will read it, not only here.

> **`node scripts/check-dist-fresh.mjs` is required verification for any phase
> that changes a screen, and a screen claim is not evidence until it has
> passed.**

**P1 proved the failure rather than arguing it.** On the first live-DOM run:

- the source was correct,
- `tsc --noEmit` was green,
- **the react suite passed 932/932**,
- and **the screen still rendered the old label**, because `dist` had not been
  rebuilt.

**A stale label would have shipped behind three green instruments.** And the
suite was not even weak evidence: **nothing asserted the string**, so flipping
it could not have gone red in either direction.

**The bundle is a SECOND READER of the source** (Verification 20), and
`check-dist-fresh.mjs` exists saying so in its own comment.

**A screen phase therefore ends with `npm run build:react`, then
`check-dist-fresh.mjs`, then a live-DOM assertion** - and the assertion matches
what is **rendered**. P1's own first attempt failed against a correct screen
because the element is `text-transform: uppercase` and `innerText` returns the
transformed text.

**This sits beside the standing qualification, not in place of it.** That one
says the eight vanilla-asserting suites are not evidence about a live screen;
this says a green suite of **any** kind is not evidence about a screen whose
bundle is stale.

---

## What P1 does NOT establish

- **Nothing about any screen beyond the relabel's one label.** The disabled
  Qualify hint, the list and the detail rendering are P2/P3.
- **The two notes display gaps are unbuilt**, by the instruction's boundary.
- **P3-P5 remain blocked on the mockups** (`image3/4/5`), still absent.
- **No gate run.** That is the round close, not this phase.
- **The follow-up task has no surface.** It is a writable pair of payload keys,
  proven on every status; nothing renders it yet.
