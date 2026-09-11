# The LEADS round: close-out

Five phases, all signed off. Nothing pushed. The word is John's.

---

## 1. The gate

**22 of 22 PASS, 0 SKIP, 0 FAIL, on `6f1cd97`**, the exact committed
tree, with a clean working tree and no dirty-tree warning.

**The door stage ran GREEN, not skipped:**
`PASS  HTTP readonly-view probe   exit 0  84967ms`.

**It took two runs, and the first one is the finding.** See section 9.

---

## 2. Commit reconciliation, by counting

`git rev-list --count 9a88f89..HEAD` is the authority. Every commit maps
to an instruction, a ruling, or a named correction.

| # | commit | maps to |
|---|---|---|
| 1 | `1ca94c5` | the round instruction: write the brief, execute P0 |
| 2 | `5a62ed0` | P0, measurement only |
| 3 | `da72acc` | rulings R1 to R4 |
| 4 | `314a4fe` | P1 items 2 to 4 |
| 5 | `47b7c9d` | P1 item 5, the follow-up task |
| 6 | `6e1d215` | P1, stop with the report |
| 7 | `fb29412` | R1 + R2, after John applied the relabel |
| 8 | `d3df5b9` | the same, post-apply |
| 9 | `52887f2` | **ruling R5**, company at Qualify |
| 10 | `ef14f15` | R5 closed |
| 11 | `daa90af` | P2 A1, and the **A3 option (a)** ruling |
| 12 | `aac7561` | named correction: four probes onto the throwing client |
| 13 | `5294e56` | P2 A2 |
| 14 | `d17133c` | P2 A4 |
| 15 | `8ceaaf2` | P2 A5 and A6 |
| 16 | `4b300b3` | named correction: the supersession reaches the enforcement |
| 17 | `e2af50d` | P2, the report |
| 18 | `0e84cee` | **the red-tree mechanical-fix ruling** |
| 19 | `7a6c362` | P2 closed |
| 20 | `6a3b3c5` | P3, the notes panel |
| 21 | `fc02c3e` | P3, the Lead Detail redesign |
| 22 | `276ff78` | P3, the report |
| 23 | `285e656` | **rulings R7 and R8** |
| 24 | `f3949f7` | P3 closed |
| 25 | `957a7a4` | P4, the door reaches the card |
| 26 | `d77a188` | P4, the grouped list and its two inline writes |
| 27 | `1a00a3d` | P4 report, and a named correction: a stale Parked string |
| 28 | `448df9b` | **rulings R9 and R10** |
| 29 | `b4ac422` | P4 closed |
| 30 | `64dac95` | P5, the batch grid and the retirement |
| 31 | `f5dc9f4` | named correction: F1 rested on an unmeasured premise |
| 32 | `9f2c533` | **rulings R11 and R12** |
| 33 | `8e1ffc2` | close: promotions |
| 34 | `aee9a6f` | close: CURRENT_STATE |
| 35 | this | close: the brief reconciled and the close-out |

**Unaccounted 0. Phantom 0.** The count is stated against `rev-list` in
section 9, taken on the final tree.

### And the count found what it is there to find

**The brief carried 8 rulings while 11 were in force.** R5, R11 and R12
were ruled in conversation and never appended. Three unnumbered rulings
- the A3 option (a), the A6 acceptance test, and the red-tree mechanical
fix - had launched work and appeared nowhere either.

That is build discipline 7's named cause, exactly: *rulings given in
conversation are appended to the brief at the phase they launch, not
discovered at the close*. **The previous round was 8 while 10 were in
force. This one is 8 while 11 were.** Same fault, consecutive rounds,
found by the same instrument.

The rule works as a DETECTOR and is failing as a PRACTICE, and saying so
is more useful than recording a clean reconciliation. All 11 are now in
the brief, with the unnumbered three recorded beside them and the gap at
R6 stated so nobody hunts for it.

---

## 3. Revert rehearsal

Run on a detached worktree; the main tree was never touched.

| | |
|---|---|
| main tree before | `8c3a161ee6da9b99db406fbfa8f3d5c149d32477` |
| main tree after | `8c3a161ee6da9b99db406fbfa8f3d5c149d32477` |
| `git revert --no-commit 9a88f89..HEAD` | exit 0, no conflicts |
| resulting tree | `a385146d6e8e22e5e6433181bfcbbca49893afe2` |
| pre-round tree `9a88f89^{tree}` | `a385146d6e8e22e5e6433181bfcbbca49893afe2` |

**Identical.** Verified by tree hash, not by reading `git status` - a
targeted restore can poison the index and leave `git status` showing two
modified files while the tree is wrong in exactly those two.

### The boundary: what a revert does NOT undo

**Two applied migrations' DATA survives a revert of their files.** Both
were applied by John through the SQL editor and both are confirmed live
by direct query, not assumed:

- `20260911000001` - `stage_definitions` for contact reads
  **`Nurture (any), Unqualified, Qualified`**. There is no Parked row to
  come back.
- `20260911000002` - `stage_gate_rules` carries
  **`Unqualified -> Qualified {"field":"company"}`**.

Reverting the files deletes the SQL, not its effect. **Unwinding either
needs a new migration, written and applied deliberately.** Nothing in
this round provides one, and that is a position rather than an oversight:
the relabel is a product decision of record and the company gate is R5.

**The soft deletes do not revert.** Every fixture this round created and
swept stays soft-deleted, correctly: `reference_number_counters` rows
were never touched, so no code can be reissued.

**R11 is a route change, not a data change**, so reverting
`src/routes/contacts.js` does restore the old creation minimum. Contacts
created with a `jobRole` keep it, harmlessly.

---

## 4. CURRENT_STATE

Regenerated at `8e1ffc2` and committed at `aee9a6f`.

**Staleness check, both halves:**

| half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** (`8e1ffc2`) |
| no tracked configuration source changed since | **PASS** (`supabase/migrations`, `supabase/seeds`, `src/routes` all clean) |

**Counts exact, not paged.** `approvals` reads **3066** in the generated
file and **3066** from an exact head-count - three times the 1000-row
page cap, so a paged read could not have agreed by luck. `records` reads
48,924 in the file against 48,995 now: **that gap is data drift, not
instrument drift**, from three database-suite runs in the pre-commit
hooks on the close commits since generation.

**The diff reconciles to the phases** with nothing unaccounted: Parked to
Nurture in both the stage table and the gate rule (R1, R2); the new
company rule taking contact's count 15 to 16 and the table 93 to 94 (R5);
and record and revision counts up from probe traffic and John's own
entries.

**Residue: none.** Enumerated from the database rather than by eye - 113
live records across **two owners, both real accounts**, zero harness
record types, and no record carrying a probe tag.

---

## 5. Promotions

Three, each extending an existing rule, each placed inside the rule it
extends with the numbering untouched.

**Verification 25 gains its mirror.** Rule 25's own sentence is "far too
SMALL a population"; every instance under it points an instrument at less
than the claim covers. A P3 probe counted note rows with
`document.querySelectorAll` and read **22 on a record that has 6**. This
app is one document with several screens resident at once. It is worse
than a narrow population because **it cannot read as empty** - a
plausible non-zero wrong number has nothing in it to notice.

**Verification 9 gains the case its own tell cannot see.** Rule 51 says
explain the SILENT injections; this one is not silent, it goes red. An
injection removed the grid's auto-extend, the run failed, the harness
printed `FIRED` - and the probe had died six lines earlier on a blur
target that exists **only because auto-extend works**. A check only ever
REACHED when it passes reads exactly like a calibrated one.

**Verification 7's replacement clause gains the control itself.** That
clause covers what must REMAIN around new markup. The retired form's Save
was `btn-primary`; its replacement shipped unclassed - present,
positioned, correctly disabled, and it saved. A white browser default on
a dark screen with every assertion green.

### Candidates considered and NOT promoted, because they are covered

| candidate | already covered by |
|---|---|
| a stale `Parked` string three phases after R1 | Architecture 9's fourth variant, a literal that rots |
| a unit test green while the screen still had the bug (A4) | Verification 47, the harness reproduces how production INVOKES the code |
| a wait satisfied by static markup before a fetch answered | Verification 7's counterfactual |
| `?? []` hiding a Supabase error in a probe | Verification 8, and the throwing-client guard caught it live |
| the red-tree commit, twice | replaced by a MECHANISM, the pre-commit hook, which is the answer rule 16 prefers to a third restatement |

**One considered and deliberately not promoted.** The harness hang -
`execFileSync` with a backgrounded subshell holds the stdout pipe for as
long as the server lives - is real and cost two minutes of healthy-looking
diagnostics. It is not promoted because a rule naming `execFileSync` and
`stdio: 'pipe'` is a rule about a mechanism, which Verification 37 warns
is presumed incomplete. The lesson is recorded at the call site, where the
next person to edit that function will read it.

---

## 6. Carried forward

1. **F3, unclassed buttons on P3 and P4 cards.** Add note and Save task
   render as white browser defaults. **No suite can see it**; it took a
   screenshot, and the one that was found belonged to P5 only by luck of
   being in the same frame.
2. **F4, `reference_code` reads null on the contacts list.** Noticed while
   writing the P5 probe, which had keyed a card match on it. Not
   investigated.
3. **F5, `teardown-scoping.test.mjs` crossing the statement timeout.**
   6,016ms normally, 15,957ms under load, where Postgres cancels it. The
   slow part is the **exact count over `record_revisions`**, which exists
   because Verification 17 requires the scan to prove it examined every
   row. **A growing exact-count on a growing table**: the coverage
   assertion is what gets more expensive, so this worsens on its own.
4. **R12, `regionForCountry`.** Country to region autofill, deleted with
   the retired form at zero readers. Carried for possible restoration,
   low priority, recorded in `DESIGN_PRINCIPLES.md`.
5. **The server-side reverse transitions.** `Qualified -> Unqualified`
   answers 200 and `DELETE /contacts/:id` is untouched. The forward-only
   lifecycle is **UI-only-enforced today**. A governance round.
6. **The two-save-controls note**, for any future card-shape work.
7. **F6, the gate runner calls a SKIP a pass.** `All 22 stages passed.`
   printed over 21 PASS and 1 SKIP. A false green inside the instrument
   the estate quotes at itself. **Should be the next round's first act**
   (section 9).
8. **F7, orphaned processes outlive their session.** Two ran for five
   days against this server and database with nothing watching them.
   Worth a standing pre-gate check that nothing foreign is running,
   since "nothing else running" is currently an assumption.

Still carried from before this round: the vanilla retirement and its
standing qualification on eight suites; the 20 under-cap unbounded
selects; the 19 routes unexercised as a non-owner, and concurrency; the
`complete-document` disagreement.

---

## 7. What this round does not establish

- **The standing qualification is still in force.** The eight
  vanilla-asserting suites are not evidence about the deal form, the
  reference tab or the version panel. Every Lead surface here was verified
  by live DOM and screenshot instead.
- Nothing was exercised as a **non-owner** on the New Lead grid, and
  nothing needs to be: creation makes the actor the owner. The door was
  proven on P3 and P4.
- **Email validity is a client-side FORMAT check only.** The server
  requires presence and does not check shape, so a malformed address from
  any other path is still accepted.
- The five screens were walked by probe, not by John. **A live walk is
  this project's stopping condition and has not happened for P3, P4 or
  P5.**

---

## 8. The five phases

| phase | what shipped |
|---|---|
| P0 | measurement only, the report |
| P1 | the lifecycle: Nurture relabel, the reachability, the Qualify gate, reason-as-note, the follow-up task |
| P2 | the six migration regressions, and a pre-commit hook |
| P3 | the Lead Detail redesign, forward-only lifecycle |
| P4 | the Leads list, grouped cards, per-card door, graduation |
| P5 | the New Lead batch grid, the single-record form retired |

---

## 9. Gate result, and the two things the gate itself found

### The result

**22 of 22 PASS on `6f1cd97`. 0 SKIP. 0 FAIL.** Clean working tree, no
dirty-tree warning, nothing else running.

`PASS  HTTP readonly-view probe   exit 0  84967ms` - the door stage,
green, on the exact tree.

### F6: the gate runner calls a SKIP a pass

**The first run of this gate printed `All 22 stages passed.` while the
door stage had SKIPPED** - `not run: no browser (set PUPPETEER_PATH)`.
21 PASS and 1 SKIP, summarised as all 22 passing.

That summary is false in the one direction that matters. The stage's own
source carries the ruling it contradicts:

> A SKIP is valid for a working gate run on a machine with no browser. It
> is UNANSWERED at a round close. **A round that closes on a SKIP here has
> measured nothing about the door.**

**A reader taking the summary line at its word closes the round on an
unmeasured door.** The instruction for this close said "door stage green
not skipped", which is what caught it; without that sentence the printed
summary would have been quoted and believed.

Verification 19's shape - a claim asserting a property nobody measured -
inside the instrument the whole estate quotes. Not fixed here, because
changing `verify-all.mjs` means re-gating and this is the close.
**Carried, and it should be the next round's first act.**

### F7: two orphaned processes from a dead session, five days old

Found while diagnosing why the gate appeared to stall: `probe-scrollable.mjs`
and `walk.mjs` from session `1b6522fb`, elapsed **5 days 12 hours** and
**5 days 9 hours**, hung against this same dev server and database.

**They were present during every gate run of this round and the last.**
Nothing was watching them and nothing would have reported them.

Killed before the second run, so the stated gate is the first this round
that provably ran with nothing else against the server. The earlier
readings are not retracted - the two were blocked, not working - but the
honest statement is that "nothing else running" was **assumed and not
checked** until this close.

**The diagnosis also cost a wrong reading of my own.** `pgrep -f
"verify-all"` matched another session's watcher loop, whose own command
line contains that string, so a wait loop reported the gate RUNNING when
it had finished. A pattern that matches watchers as well as the watched
is Verification 17's shape: the probe fired perfectly against the wrong
thing.
