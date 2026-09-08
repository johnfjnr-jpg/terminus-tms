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

---

## 7. The push, confirmed

Asked of the remote directly rather than read from a local ref:

```
$ git ls-remote origin refs/heads/main
33a205308c8347041f91605584fb9ce5b6d20a63	refs/heads/main

remote head    33a205308c8347041f91605584fb9ce5b6d20a63
local HEAD     33a205308c8347041f91605584fb9ce5b6d20a63
the gated tree 33a205308c8347041f91605584fb9ce5b6d20a63
all three match, 0 unpushed
```

**The word followed the stated gate result**, which is the rule this round put
into `CLAUDE.md`. That is its first clean application: the gate reported 21 of
21, the result was stated, and the push happened after.

---

## 8. R11: the evidence rows deleted, counted

**5 of 5 deleted**, dependents checked first (0 approvals referencing the
request, 0 requests freezing either version, so nothing was orphaned).

| row | result |
|---|---|
| `5f1517b2` version created by a non-owner, on walk65's real record | **deleted** |
| `e975b27e` version **issued** by a non-owner | **deleted** |
| `0197a77d` request that moved a record | **deleted** |
| `a7178858` probe record that carried the issued version | **soft-deleted** |
| `e70d0755` probe record that carried the request | **soft-deleted** |

**R11's named requirement is met:**

```
walk65's opportunity 29e98c46: 1 version - V0.1 draft by terminus.walk65@gmail.com
  of which created by this probe account: 0
live records owned by the test account: 0
live probe-account records from today: 0
```

### And the residue counter was written wrong, which found something

The first version asserted *"zero `deal_sheet_versions` created by this account,
anywhere"*. It read **3,165**. That is every fixture row this test account has
written since Milestone 1, across every round - an unmeetable claim that says
nothing about this round. Verification 19: a category name, *probe artefact*,
checked against the wrong population.

**Rewritten as the claim that matters - rows this account wrote on records it
does NOT own - it surfaced seven the approved list did not name:**

| what | where | state |
|---|---|---|
| 5 `deal_sheet_versions` | on probe-account records `bb766625`, `2a004f1d`, `2cf7005f`, `4f665bc6`, `513a12f0` | **all five records already soft-deleted by R10** |
| `b839633b` request | on `6e706cc5` | this round's owner-counterfactual; **record already soft-deleted** |
| `b3a352f7` request | on walk65's **live** record `e5f8f1de` | **withdrawn**, and `requested_at` is **2026-09-02** - six days before this round. An earlier round's artefact, not this one's |

**None of these is deleted.** They were not in R11's approved list, and a data
change beyond a ruling is exactly what this method forbids. Every one is either
a child row on a record already soft-deleted and invisible to the application,
or - in the single live case - a withdrawn request from a different round.

**Proposed for a ruling**, and deliberately not urgent: the five versions and
`b839633b` go with their already-deleted records if anything; `b3a352f7` belongs
to whichever round created it on 2026-09-02.

---

## 9. R12: accepted for the next round's opening

Recorded here so the next brief carries them rather than the memory:

1. **A revert rehearsal restores from an explicit ref, never from the index, and
   verifies the tree hash rather than reading `git status`.** §3's measured
   argument: `git checkout -- path` restored the poisoned index and left main
   carrying the pre-fix routes while `git status` showed two modified files.
2. **Rulings given in conversation are appended to the brief at the phase they
   launch.** §2's measured argument: this brief carried 8 rulings while 10 were
   in force, and the gap was found by counting at the close rather than when it
   opened.

---

## 10. Carried items

| item | note |
|---|---|
| **The parked UI hygiene round** — its brief sits in the repo unexecuted. The door presentation work resumes now, and it resumes on firmer ground: the door can finally communicate a boundary the server actually enforces | R1 |
| Its three cosmetic items: the Test Bed cost cell, the Opportunity Reference column, the Structural Terms notes | parked with it |
| **THE NAMED NEXT PROBE: Test Bed and Contact write paths, unexercised as a non-owner.** Every live proof in this round used an Opportunity. `POST /test-beds/:id/scores`, `/measurability`, `/buyer-contacts`, `/tech-team`, `/units/:unitId`, and the Contact `PATCH` and `link-account` routes. The policies are shared so the shapes carry — **but that is an argument, and this round is what happens when a security claim rests on one** | |
| No manager override; an explicit roles feature in its own round if ever wanted | R7 |
| The seven unruled probe rows in §8 | proposed, not applied |
| The convert round's four: reference code on soft delete · Opportunity list Reference column · nineteen self-recording migrations · nothing detects a stale dev server | unchanged |

---

## 11. What this close does NOT cover

- **The sibling surfaces**, named above. This is the largest gap and it is a
  deliberate one: the round fixed what it proved, and proved what it fixed.
- **No walk.** Nothing was opened in a browser this round.
- **The live policy set.** `pg_policies` is unreadable from here; every policy
  claim is source-derived and every enforcement claim is behavioural.
- **Whether the three holes were ever exploited** before they were found.
- **That no other identity-shaped write exists.** The census was taken at Phase
  0 and not re-run after the migration.
- **When `b3a352f7` was raised and by which round.** Dated 2026-09-02; not
  traced further.

**The round is closed.**
