# The write authorization round: close-out

A hygiene round stopped on a stop condition. **Three ways for a non-owner to
write to somebody else's record, all closed and all proven closed.**

---

## 1. What the round did

The UI hygiene round set out to fix a door that looked shut. Its Phase 0
required the server to be proven to refuse what the door let through, **and the
server did not refuse**. That parked it and created this round.

| GAP | before | after |
|---|---|---|
| version INSERT by a non-owner | **201** | **403**, ownership-shaped |
| version ISSUE by a non-owner | **200**, V0.1 → V1.0 issued | **403**, still a draft |
| transition REQUEST by a non-owner | **201**, auto-approved, **record moved** | **403**, 0 requests written |
| `document_details` write by a non-owner | permitted (source) | **403**, stored value unchanged |

**All four had live proofs before shipping** - R9 exists because the fourth did
not, and closing a security gap on a source reading is how you ship a policy
that does not do what its author thought.

**One migration**, `20260908000002_writes_are_owner_scoped.sql`: three policies
reshaped from identity to ownership, and `raise_transition_request` - a
SECURITY DEFINER function that read `auth.uid()` and never asked whose record it
was - gaining the check it never had. **Two route refusals**, not four: the
version-save route already routed its error correctly and did not need a third.

**And what did NOT change is written into the migration**: `audit_log` and
`approvals` stay identity-shaped, because owner-only there would break the
features. *Approvers endorse, owners execute.* A later reader reaching for
owner-only everywhere is the likeliest way this gets undone.

---

## 2. Reconciled by counting

| | |
|---|---|
| rulings | **10** (R1-R10), no gaps |
| commits | **7** before this one |
| ruling artefacts checked against the thing that exists because of them | **11/11** |
| GAP rows closed | **4 of 4**, each with a live proof |
| probe results | Phase 0 found 3 holes · Phase 1b **13/13** · R9 **7/7** |
| preserved flows | `probe-pricing-approval` **15/15** · `probe-commercial-gate` **11/11**, re-run against the applied migration |
| teardown | **0** live records owned by the test account · **3/3** evidence rows intact |

**The brief carried 8 rulings and 10 were in force.** R9 and R10 were ruled in
conversation and never written down until this close appended them. Build
discipline 7's shape again: *the brief is not a reliable source for the count.*

---

## 3. The revert, rehearsed - and the rehearsal damaged the tree

**The product reverts cleanly.** Both route files restore byte-identical to
their pre-Phase-1 state and the pure suite reads **493/493** on the reverted
content.

**The migration is NOT independently revertible**, and two of the three
combinations were measured rather than assumed:

| | measured |
|---|---|
| policy + route | all three refused **403 ownership-shaped** (Phase 1b, second run) |
| **policy alone** | version insert **403**, issue **409** zero-rows, request **HTTP 500** carrying the ownership sentence — refused, badly worded. Measured by accident against the stale server in Phase 1b's first run |
| route alone | **NOT MEASURED.** Inferred and named as inference: the issue route's own check would still refuse; the other two reopen, because the version insert has no route check and the transition route's 42501 mapping never fires if the function does not raise it |

**So reverting the migration reopens two of the three holes.** The routes are
revertible and the cost is only the words.

### The rehearsal harness broke the thing it was rehearsing. Twice.

Recorded because Verification 44 is about exactly this and both faults are new
shapes of it.

- **`git revert` over a range that included a probe's own history** conflicted
  on `probe-owner-scoped.mjs`, which one commit created and the other amended.
  Aborted; main byte-identical. Reverting a range measures the range's history,
  not the product.
- **The worse one.** `git checkout <ref> -- path` followed by
  `git checkout -- path` restored from the **INDEX**, not from HEAD - so main's
  working tree was left carrying the **reverted, pre-fix routes** while `git
  status` showed only two modified files. Had the gate run at that moment it
  would have gated the reverted code and passed.

  Verification 44 warns that `git checkout` reverts to the last commit rather
  than to the pre-injection bytes. **This is its inverse: `git checkout --` with
  no ref reverts to the INDEX**, which a targeted restore has already poisoned.
  Recovered with `git checkout HEAD -- ...` and verified byte-identical.

**Proposed for promotion, not written:** a rehearsal restores from an explicit
ref, never from the index, and verifies the tree hash afterwards rather than
reading `git status`.

**And one observation about reverting an ADDED file:** `git checkout <ref> --
dir/` does not remove files added since that ref, so the migration file survived
the restore. A revert that must remove a file has to delete it explicitly.

---

## 4. The evidence rows: disposition proposed, not applied

R2 kept these through the round as the real-world positive control, and the
fixed policy was shown refusing exactly the write that made the first one.

| row | where | proposal |
|---|---|---|
| `5f1517b2` V0.2 draft — a version a non-owner created | on `29e98c46`, **walk65's real opportunity** | **Delete.** It is a version on a record that is not a fixture, created by an account that should never have been able to. It is the only probe artefact sitting in a real record |
| `e975b27e` V1.0 **issued** by a non-owner | on `a7178858`, a probe fixture | **Delete with its record.** Both held back from R10's teardown only to keep the evidence intact |
| `0197a77d` request that **moved** a record | on `e70d0755`, a probe fixture | **Delete with its record** |

**Two probe-account records remain live** — `a7178858` and `e70d0755` — held
back from R10 precisely because deleting them would have gutted the evidence.
They go with their rows.

**Nothing is applied.** This is a proposal for a ruling, as R2 requires.

---

## 5. Carried items

| item | note |
|---|---|
| **The UI hygiene round is parked**, its brief in the repo unexecuted. The door presentation work resumes now that the server enforces what the door must communicate | R1 |
| The three cosmetic items in that brief: the Test Bed cost cell, the Reference column, the Structural Terms notes | parked with it |
| **No manager override exists.** If ever wanted it arrives as an explicit roles feature in its own round, never as a loose policy | R7 |
| The convert round's four carried items, unchanged | reference code on soft delete · Opportunity list Reference column · nineteen self-recording migrations · nothing detects a stale dev server |

---

## 6. What this close does NOT cover

- **The sibling surfaces, named.** Every live proof used an **Opportunity**.
  The policies are shared, so the shapes carry - but **Test Bed** and **Contact**
  write paths were never exercised as a non-owner. `POST /test-beds/:id/scores`,
  `/measurability`, `/buyer-contacts`, `/tech-team`, `/units/:unitId`, and the
  Contact `PATCH` and `link-account` routes are untested by this round.
- **No walk.** Nothing was opened in a browser. That is the parked round's work
  and it is now the natural next step: the door can be made to communicate a
  boundary that is finally real.
- **The live policy set.** `pg_policies` remains unreadable from here. The
  evidence is behavioural throughout.
- **Whether the holes were ever exploited.** Nothing was measured about
  historical rows.
- **That no other identity-shaped write exists.** The census was taken at Phase
  0 and not re-run after the migration.
