# Deal Sheet versions, and the installation defect

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 36 merged to `main`
at `05e2ab5`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

Two things. **The first is a defect in what Round 36 merged**, reported by the
business on first use.

> *"The installation cost when selecting a per unit installation is not
> calculated."*

**The second is the Deal Sheet**, and the business's framing changes what it
is:

> *"The deal sheet is the artefact that will be used to review the pricing to
> go into the proposal for issue to the customer. It needs to contain all of
> the input parameters required to be able to calculate the price and we need
> the ability to be able to create versions of the deal sheet as we go. The
> ability to save a version of the dealsheet should be a manual action. We
> should also be able to recall the old version of the proposal."*

**Not a snapshot of a screen.** The artefact reviewed before a proposal is
issued, carrying every input needed to reproduce the price.

---

## The installation defect

**Round 36 verified hardware and hosting by hand and did not verify
installation.** That is a gap in the verification rather than in the report,
and it is why this needs establishing rather than guessing.

**Three candidates:**

| | |
|---|---|
| The catalog's install figures are read but never totalled | A calculation defect |
| Installation is computed, but the responsibility model does not exist | Working as far as it goes, and the Installation tab is the missing piece |
| The units-to-infrastructure split does not reach the install lines | The AQ Sensor placeholder shape from Round 36 Phase 2 |

**The third has a precedent worth naming.** Round 36 Phase 2 found four AQ
Sensor units silently discarded because the markup carried a placeholder rather
than the key the reader wanted. **That was caught by reading the boxes and
multiplying by hand**, which is the check that did not run on installation.

**Establish which. Do not guess.**

---

## The Deal Sheet, as decided with the business

| | |
|---|---|
| **What it is** | The artefact reviewed before a proposal is issued. Carries every input needed to reproduce the price |
| **Saving** | **Manual.** A deliberate act, not automatic |
| **Numbering** | Major is *issued to the customer*, minor is *worked on internally*. V1, V1.1, V1.2, V1.3, then V2 |
| **Issuing** | **A draft becomes the issued version.** V1.3 is relabelled V2 rather than copied to it |
| **Recall** | **Restore**, not read-only. It is what you want during a negotiation |
| **Proposals** | One-to-one. A proposal points at exactly one version |

### What "becomes" means

**V1.1 to V1.3 are the same document being worked on, and the one you finish is
the one you send.** A copy would leave V1.3 and V2 identical, which is two
records of one fact.

**So a version carries a status — draft or issued — and issuing is what
promotes the next major.**

### The freeze this replaces

`DESIGN_PRINCIPLES.md` records that **the Deal Sheet freezes at the Proposal
gate**, automatically, as an application of the immutable-approved-snapshot
principle. Round 20 Phase 0 found the transition it was named against no longer
exists and recorded the freeze point as needing renaming.

**Confirmed with the business: manual save replaces the automatic freeze.** A
version somebody chose to take is a better record than one the system took on
their behalf.

**Record it as a supersession with the reasoning**, not as drift. Two mechanisms
doing one job is the failure this project has recorded most often.

### One consequence of restore

**Restoring an old version overwrites the current pricing.** If V2 work is
unsaved, restoring V1 loses it.

**Either restore forces a save first, or it refuses while there are unsaved
changes.** Round 28 built an unsaved-changes guard and Round 34 extended the
pattern. **Report which applies; do not invent a third.**

---

## What a version has to carry

**Round 36 Phase 0 established this and it is the round's central constraint:**

> *A pricing version cannot point at a batch and be complete. Batches carry the
> four catalog costs; the deal carries per-line margins, a warranty percentage,
> currency and contingency. A pricing version is the deal's inputs plus the
> batch.*

**So a version is:** the unit counts, the per-line margins, the warranty
percentage and its separate-or-rolled-up setting, the bid and proposal
currencies, the contingency, the term, and **a reference to the batch that was
current when it was taken.**

**Two of those do not exist yet.** The Installation, Structural Terms and
Payment Terms tabs are unbuilt, so a version taken today cannot carry the
installation responsibility, the milestones, the tax adjustments or the payment
structure.

**That is a real scoping question and it is the plan's main decision.**

---

## Investigations

### I1. The installation defect

**Establish which of the three candidates it is**, from the code and by reading
the boxes and multiplying by hand.

**Report what the Commercials tab computes for installation today** and against
what inputs.

**Report whether installation responsibility exists anywhere.** The prototype
has four options — client's own team, contractor per unit, contractor lump sum,
reseller — with client-own and reseller costing Terminus nothing. **If none of
that is built, the per-unit case is the only one that can work and the defect
may be that it does not.**

### I2. What the Deal Sheet is today

**The question.** `DESIGN_PRINCIPLES.md` refers to a Deal Sheet that freezes at
a gate. **Does it exist as an artefact, or only as a concept?**

Report whether anything renders a Deal Sheet, whether anything freezes, and
what the four-figure strip above the Commercials tab is — **Contract Net,
Achieved Margin, Total Deal Cost, Finance Cost.**

**Report what "the Deal Sheet" names in the codebase**, if anything.

### I3. Versions: shape and precedents

**Report the options and their costs. Do not choose.**

**Three precedents exist and none is quite this:**

| | |
|---|---|
| `record_revisions` | Every save is a revision with a complete payload. **Automatic, not chosen** |
| Assessment scores | Append-only series entries with author, timestamp and reason. **Per criterion, not per document** |
| `product_cost_batches` | Immutable rows with `effective_from`. **No author, no status** |

**A Deal Sheet version needs a status, a two-part number, an author, a
timestamp, and immutability once issued.**

**Report what "immutable once issued" enforces against.** Round 36 Phase 1
established that only the service role can write and every route uses it, so
immutability is a property of the fetching route rather than of the table.
**This is the round where a `USING (false)` policy on `product_cost_batches`
can finally be verified**, because it is the round that creates the pointer.

### I4. The incomplete-inputs problem

**A version taken today cannot carry the installation responsibility, the
milestones, the tax adjustments or the payment structure**, because those tabs
are unbuilt.

**Report the options:**

- **Build versions now**, carrying what exists, and extend the payload as the
  tabs land. **A version taken today would not reproduce a price taken next
  quarter.**
- **Build the remaining tabs first**, then versions over a complete input set.
- **Something else.**

**This is the plan's main decision and it belongs to the business.** Report the
options with their costs and do not choose.

### I5. Restore against the unsaved-changes guard

Report what the guard covers today and what restore would have to do.

**Round 28 Phase 7 established the guard covers a record change and a page
unload**, deliberately not a tab change, and Round 34 extended it to the
Reference tab's fields.

**Report whether restore forces a save or refuses**, and say which the existing
mechanism supports without a third pattern.

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong six times in
seventeen rounds**, most recently a hover defect filed against the wrong screen
and a `contact_role_linked` risk aimed at an excluded record type.

---

## The plan to produce

**Deliberately not proposed.** The I4 answer determines whether this is one
round or three, and proposing a shape ahead of it would anchor the decision.

**Report a plan for each I4 option**, with its phase count, so the business can
choose against real numbers rather than against an impression.

**The installation defect is Phase 1 under every option.** It is live, it is
small, and it is the tab the business is pricing on.

---

## Verification requirements

**Read the inputs and multiply by hand.** Round 36 Phase 2's 12,000
disagreement and Phase 3's warranty defect were both found this way, and the
installation defect exists because that check did not run on installation.

**Check at two different mixes.** Round 36 Phase 3 found a missing `Math.ceil`
that rounds to the same integer at one mix and separates at another. **A figure
that is right at one input can be wrong at the next.**

**A removal is two claims** — the thing is gone, and what replaced it still
works.

**Establish Test Bed reachability rather than running a pixel check.** Test Bed
has its own Commercials tab with cost rates typed per record.

**Test data may be deleted rather than migrated.**

**Calibrate on the kind of change each phase makes**, and check the calibration
is in the right file.

**No probe prints a conclusion it has not computed.**

**Capture the whole run, never through a filter.**

**Enumerate teardown from the database by this round's tag, paged**, and in
dependency order — Round 36 Phase 3 found `contacts` carries an `account_id`
with no `ON DELETE` behaviour while `record_contacts` and `records` cascade.

---

## Explicit non-goals

- **The Installation, Structural Terms and Payment Terms tabs**, unless the I4
  answer pulls them in.
- **The pipeline panels.**
- **Industry on the Customer panel**, confirmed as coming from the Account and
  overridable.
- **The sub-contractor pricing criterion**, confirmed as Commercial lens at
  Solution Alignment. Configuration.
- **Renaming Record to Save on the Key Contacts panel.**
- **Currency conversion**, and the non-USD catalog case. Structural Terms owns
  it.
- **The Risk assessment**, parked.
- Round D, the truncation fix, the renderer and draft-store fork, Opportunity to
  Test Bed conversion, hosting for internal comment.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: which of the three, and what fixes it.
3. **The I2 answer**: does a Deal Sheet exist, or is it a concept.
4. **The I3 options**, with costs, not chosen.
5. **The I4 options, with a plan for each**, for the business to choose.
6. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
