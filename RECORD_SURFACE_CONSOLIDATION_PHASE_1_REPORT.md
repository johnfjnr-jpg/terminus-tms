# ROUND B, Phase 1: a PARTIAL, and R1 is the part that stopped

Committed at `fd928e4`. Suites by exit code: **pure 539/539, react
979/979, database 100/100.** Conformance gate 9/9.

---

## 1. WHAT IS NOT BUILT

**R1 is not shipped. R2's section has nowhere to appear until it is.**

**R1 was built, measured, and reverted.** It works. **It is not shipped
because shipping it would have put a half-migration of a live screen into
the tree**, and the reason is specific rather than general:

> **The swap leaves 15 tests addressing markup that no longer renders**, and
> those 15 are the only automated protection the contact screen's
> behaviours have - the save path, the qualification tinting, the industry
> lookup, the revision handshake.

**Re-pointing them in the same change that rewrites the screen is exactly
the pattern this estate distrusts most**: Verification 47, a probe written
after the change tests the change. **On a screen serving 10 live records,
with the walk still pending, I was not willing to rewrite the code and its
protection in one motion and call it green.**

**It is doable properly** - derive the new assertions from the contract and
calibrate with injections, which is what the shell components got last
round. **It is a phase that says so**, not a side-effect of this one.

---

## 2. What DID land

**R3, the mode flag.** `mode` on the shared surface governs the **framing**:
`complete` shows "Please complete missing data", `view` does not.

**R2's `AccountSection`**, as a `Panel`, so the conformance gate governs it.
It reads **`records.parent_record_id`** - the one source - and **renders
nothing at all for a lead**, decided by the record rather than by a flag.
**Four unit tests, both branches.**

**An `onSaveChanges` seam** on the surface, so a host that owns its own
write keeps it. Section 3 says why that is not optional.

---

## 3. Three findings, all from the reverted work

### A LIVE DEFECT: every Qualified contact is told it has no account

`ContactPanel` renders `record.account?.name ?? 'Not linked'`.

**No route returns an `account` object.** Measured: `GET
/api/contacts/:id` returns 17 keys and none is `account`; `GET
/api/contacts` returns 10 Qualified rows, **0 with an account object and 10
with a `parent_record_id`.**

> **All ten live Qualified contacts have an account, and the screen tells
> every one of them "Not linked".**

The subject of the baseline is linked to **"Singapore Instutue of
Technology"** and shows *Not linked*.

**`AccountSection` fixes it by construction** - it reads
`parent_record_id` - **and keeps LINKED-BUT-UNRESOLVED distinct from NOT
LINKED**, because collapsing those two is what made this invisible.

### THE SWAP LOSES AN AUDIT TRAIL, and no test on the shared surface could have seen it

`ContactHost.onSave` writes **one Notes History entry per save session** -
*"Job Title changed from X to Y. City changed from A to B."* The shared
surface's own save just PATCHes the payload.

**Routing the contact's fields through it would have deleted that trail
silently.** No test on the shared surface could have noticed: **the surface
never had the behaviour to lose.**

> **Verification 49's clause one layer below where Phase 0 looked.** Phase 0
> censused what the screen RENDERS. **A capability can live in a SAVE PATH**,
> and no component census reaches it.

Fixed by the `onSaveChanges` seam before the revert, so the design is
proven rather than merely noted.

### AND I OVER-APPLIED R3, which is the round's own watched fault

I passed **`blocking={[]}`** in view mode and **wrote a comment
rationalising it**: *"handing it the real list would make the mode flag the
only thing standing between a detail view and a to-do list."*

**R3 says "no missing markers WHEN NOTHING IS MISSING", which an empty list
already delivers.** My version suppressed markers **always** - stronger than
the requirement - and **deleted the contact screen's qualification
tinting**, which four tests caught.

> **The proxy fault in another costume: I implemented what made my
> mechanism clean rather than what the requirement said, and argued for it
> in a comment.** Corrected: the mode governs framing, the server's list
> governs marks.

---

## 4. The baseline, captured before anything changed

Phase 0's own closing note asked for it. Taken at **1240, 1920, 3440** on a
real Qualified contact, with a live capability census: **10 cards, Park
present, the create section present, 31 controls, 15 field rows.**

**0 of the 10 Qualified contacts are owned by the probe identity**, so the
baseline is the NON-OWNER view. **A parity comparison must account for the
door**, and Phase 2's would need an owned fixture or John's own eyes.

---

## 5. On the round's watched question

**Neither instrument fault this phase was a threshold**, and nor were Phase
0's two.

| fault | shape |
|---|---|
| Phase 0: a matcher reporting "nothing renders it" for five rendered components | a shell-escaped regex, a matcher that could not match |
| Phase 0: TypeScript generics counted as components | an extractor with the wrong grammar |
| Phase 1: `blocking={[]}` | **a requirement over-applied, and rationalised** |

**Verification 47's new remedy - take the threshold from the requirement -
would have caught none of the first two and, read generously, the third.**
**Instrument faults come in more than one shape, and the walk remains the
backstop.** That is the honest input to the carried question.

---

## 6. THE WALK IS PENDING AND REQUIRED

**And its scope has changed, because R1 did not ship.**

There is **no consolidated contact surface to walk yet.** What is worth
your eye now:

1. **The "Not linked" defect** - open any Qualified contact and confirm the
   account line is wrong. **That is a live, user-visible fault**, found by
   this phase and not fixed by it.
2. **Whether R1 should proceed as its own phase** with the 15-test
   re-pointing budgeted, or take a different shape.

---

## 7. What this does NOT establish

- **That the consolidated surface renders a contact correctly.** It was
  built and reverted; the screenshot of it was never taken at three widths.
- **Anything about Park, stage progression or create-from**, which are
  untouched and still on `contact-detail`.
- **Field-level parity beyond the count.** The two field sets are 15-for-15
  by name, differing only in the industry key - **that is a name match, not
  a behaviour match.**
