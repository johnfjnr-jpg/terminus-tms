# Group A: close-out

**CLOSED** on the green gate at `e229c8b`: **24 of 24, exit 0, ONE run for the
batch**, light path. **PUSHED** - `ls-remote` confirms `origin/main` = local
HEAD = `4c422e6a0b7fe071ce081ce87d2445f94561db18`.

**John's walk confirms the batch as consistent across all six items.**

**NO SERVER RESTART**, measured rather than assumed: **`src/` is unchanged
across all three Group A commits.** `frontend/style.css` needs a browser
reload; `frontend-react/dist` is tracked and moved with its source.

---

## What shipped

| | |
|---|---|
| **A1** | the `Latest 2 / Last 10 / All` rungs and `Add note` on the NOTES header line |
| **A2** | that control reads **"Save"** once the field is open |
| **A3** | the contact adopts the lead's **one-row** Summary / Notes / Follow-up |
| **A4** | the completion sheet opens **below** the card body |
| **A5** | the Contacts list opens Create on **click**, with Escape and click-outside |
| **A6** | the Summary row stops repeating its panel title; the first field card becomes **"Personal Details"** |

## THE LIGHT PATH'S FIRST USE: VALIDATED

**Recorded in `DESIGN_PRINCIPLES.md` section 4**, under the principle itself,
as evidence rather than as a preference.

**Six items, one round, one gate run, one walk.**

**The screenshot caught three layout defects no assertion could** - a header
rendering on top of its neighbour, a label wrapping with its control clipped,
and a blank label still holding its 170px column. **All three were introduced
by the batch and fixed inside it.**

> **A full-path treatment would have found NONE of them.** A Phase 0 census
> and a both-direction injection sweep measure logic, and not one of the three
> was a logic fault.

**And each was then ASSERTED**, which is what stops the light path becoming
"just look at it": header items share one row by equal `top`, the control's
right edge sits inside its header's, the empty label reserves zero width.

**A2 was flagged as a behaviour suspect and MEASURED before it was changed** -
the control already opened when closed and committed when open, so it is a
label and the save path never moved. **It stayed light on evidence, not on
assumption**, which is the limit working rather than being worked around.

**One item strained the boundary and was flagged**: A4's React portal is
structural rather than CSS. It carries no logic, data or auth, so it stayed
light, and it is exactly the shape where *cosmetic* is an argument rather than
a fact.

**Proportionate testing works. Batching works. This is the model for cosmetic
rounds going forward.**

## Bookkeeping

`CURRENT_STATE.md` regenerated at `4c422e6`; **staleness both halves PASS**
(ancestor, 0 configuration sources changed). **All diff lines reconcile**: the
bundle moved with Group A's build, the commit counts moved by exactly the six
commits since the last regeneration, and **the LIVE counts did not move at
all** - 158 live, 11 Qualified contacts, 6 Unqualified, no fixture residue.

**This close-out and the `DESIGN_PRINCIPLES.md` record are markdown with no
gate reader, measured per file, and RIDE the green gate at `e229c8b` under
build-discipline 48(a) - named here, which is the control that clause
requires.**

---

## AND THE CLOSE HIT A RED SUITE THAT WAS NOT GROUP A

`teardown-scoping.test.mjs` refused the bookkeeping commit. **Not Group A** -
these changes are frontend-only and the same suite passed 102/102 in the gate
on the exact tree that was pushed.

**The diagnosis, and it is deterministic rather than flaky.** The test asserts
`ledgerTags.length === TAG_CHUNK_SIZE` (3), builds `ledgerTags` from the ledger
**MINUS its own two tags**, and therefore **counted only other runs' leftovers**.
It passed for a long time because the estate was never clean enough to starve
it. **Group A's probes tore down everything they made**, the ledger was left
holding exactly this test's two tags, and it failed.

> **The failed run then left its own two tags behind, so a re-run would have
> borrowed those and gone green.** The bug restores the litter it needs. That
> is why it reads as a flake, and why it was NOT re-run: a green there would
> have destroyed the evidence.

**Ruled: fix the test, not `--no-verify` past it.** The failure is true - a
test coupling bug - and committing past it would hide exactly the thing good
hygiene had just exposed.

**Done in order:**

1. **The residue swept.** 30 live `harness_*` records the failed run left, plus
   8 `a1keep`/`a1deep` fixtures - enumerated from the DATABASE by type and tag,
   **soft-deleted** (V11), and **re-queried to confirm**: 0 remaining. Live went
   **158 to 128**, and the 30-row gap is the harness rows - which means
   **`CURRENT_STATE` had been recording harness residue as live.**
2. **The test now creates the three tags it needs** rather than borrowing a
   third. **Proven on a STARVED ledger** - the condition that exposed the bug,
   not the polluted state a re-run would have measured: with fewer tags
   available than the old assertion required, **6 of 6 pass.**
3. `CURRENT_STATE` regenerated on the clean estate.

**What this fix does NOT close, stated rather than implied:** the test's
population assertion (`population > 1000`) still leans on the ledger's
accumulated history, because one fixture is **3 revision rows and 3.8 seconds**
- reaching 1,000 rows by the normal path would take about 334 fixtures and
twenty minutes. That coupling is real, is a second and deeper one, and this
round did not close it.

## Carried

1. **`StageActions` is outside the conformance gate** - its closure starts at
   `leads/LeadsList.tsx` and nothing under `leads/` imports it, so the Create
   control is not gate-covered. **The gate's closure should reach it.**
2. **The two unstyled buttons (F3)**: `Link to Account` and `Save task`.
   Verification 7's fourth axis names them.
3. **(d) full `ContactHost` retirement** - unscoped.
4. **The ENFORCEMENT GAPS carrieds**: P4's four rotted assertions, P5/P6, the
   mechanical-fault hardening, the features, and the Sections 6-11 walk.
5. **The teardown test's SECOND coupling**: its population assertion still
   depends on the ledger's accumulated history, which a fresh checkout does not
   have. Named in this close, not closed by it.

## NEXT: Group B, NOT OPENED

Recorded from John's last two walk observations, to be opened **on his go
rather than automatically**:

- **B1 - Accounts**: Linked Contacts rendered as the contact-details grid,
  full width, scrollable. Currently a bare list. **Adds a grid to a screen, so
  likely MEDIUM.**
- **B2 - Opportunities**: standard field display, no white highlight.
  Currently pre-standard white inputs. **Mostly the field-display swap, so
  LIGHTER.**

**Both are the same shape as R1**: point fields at the shared grid, no white
inputs.
