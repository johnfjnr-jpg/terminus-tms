# Base cost data: the product catalog

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 35 merged to `main`
at `9671e74`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

**The Opportunity Commercials tab is already built and reads zero, because the
data it mirrors does not exist.**

Its own screen says so: **"COMPUTED PRICING (USD) · COSTS MIRRORED FROM BASE
COST DATA"**. Units Required carries four entries, Unit Cost and Warranty
carries three products plus a warranty provision line, Hosting carries three,
every margin cell reads `target`, and every figure reads `$0`.

**This round supplies what it mirrors.**

`DESIGN_PRINCIPLES.md` Section 6 describes a `product_defaults`-driven flow and
was found stale in Round 5. **Round 20 Phase 0 reframed it as a control gap
rather than a documentation gap:** the cost lines are freely editable payload
fields on each record, so two deals priced in the same week can use different
hardware costs and nothing compares them. The Round 17A rule guarantees one
calculation path; it does not guarantee one set of inputs.

**The business has now supplied the inputs.** This round closes it.

---

## Decided with the business

| | |
|---|---|
| **Scope** | The catalog only. The tab consuming it is next, not now |
| **Batches** | **Per product.** A manufacturing run is per product and they arrive at different times |
| **Maintenance** | **Admin.** Same governance as the role catalog and the Closed Lost reasons |
| **Warranty** | Separate line or rolled into the hardware price, **and the choice is per deal**, not a display toggle |

### The costs

| Product | Unit | Install, existing infra | Install, new infra | Hosting per month |
|---|---|---|---|---|
| SafeSight | 8,000 | 2,000 | 20,000 | 200 |
| Air Quality | 2,000 | 500 | 1,000 | 100 |
| HEMIR | 100,000 | 5,000 | 10,000 | 500 |

**Existing versus new infrastructure is an installation distinction, not a
hardware one.** The unit cost is the same; existing infrastructure means using
lampposts that are already there, new means installing poles and networks.

**And it applies only on a per-unit installation basis.** Under a lump-sum
contractor price the installation cost is the lump sum and the split does not
apply. **That is the Installation tab's problem, not this round's**, but the
catalog's shape must not assume otherwise.

### Why batches matter beyond a price list

The business: *"We may get a batch of new unit prices in from a manufacturing
run. Unit prices are associated with a batch number. Any new prices will become
current. One of the things the solution needs to do is be able to retrace
through previous approved versions of the pricing."*

**A batch is what a pricing version will later capture.** When a proposal is
approved, the pricing configuration is saved as a version; a re-price during
negotiation is a new version, taking whatever batch is current then. **That is
how margin movement across a deal's life becomes visible.**

**The pricing-version mechanism is not this round.** But the catalog is what it
snapshots, so its shape has to support being pointed at from a frozen record.

**The pattern exists three times over:** approved snapshots are immutable, the
Deal Sheet freezes at the Proposal gate, and assessment scores are append-only
with author and timestamp. **This is that pattern applied to pricing.**

---

## Investigations

### I1. What the Commercials tab reads today

**The question.** The tab renders three products, four unit entries and a
warranty line, all at zero. **What is it reading, and from where?**

Report the field names, whether they are payload keys, and what computes the
displayed figures. **Report whether a calculation engine exists behind it or
whether the zeros are placeholders in markup.**

**Report which of the four unit entries maps to which product.** The screen
shows SafeSight existing infra, SafeSight new infra, AQ Sensor and HEMIR — four
inputs against three products, because the SafeSight split is an installation
distinction. **Confirm that is how the built screen treats it.**

Round 20 Phase 0 found the cost keys writable per record in
`SALESPERSON_WRITABLE_KEYS`. **Report whether they still are and what writes
them.**

### I2. The precedents for an admin-maintained catalog

Three exist and they are not the same shape:

| | |
|---|---|
| `closed_lost_reasons` | `id, label, sort_order, active`. Retirement by flag |
| `contact_roles`, `contact_stances` | Round 35, same shape, select-only RLS with no insert policy |
| `industries` | `GET`-only, edited in the Supabase editor |

**Report what "admin-maintained" means today.** Round 35 established it means
editable as database rows and by nothing in this application, with Section 7
Admin out of v1 scope.

**A batch is not a vocabulary row.** It carries dated numeric values and is
pointed at by records. **Report what that changes** — retirement by flag may
not be the right shape when the question is which batch was current on a date.

### I3. The shape of a batch

**Report the options and their costs. Do not choose.**

Candidates:

- **One row per product per batch**, carrying the four figures and a date.
- **A batch header plus lines**, if a batch needs its own metadata.
- **Something the codebase suggests.**

**Report how "current" is determined.** By date, by an `active` flag, or by
being the most recent. **Each answers "which batch was current in March"
differently**, and that is the question a pricing version will ask.

**Report what a superseded batch must keep.** Once a pricing version points at
a batch, that batch cannot change or disappear. **The same append-only
reasoning as the assessment scores.**

### I4. Currency

The catalog is in USD and the tab reads USD. The prototype's Structural Terms
carries a Bid Currency defaulting to USD, described as **"the currency our
costs are held in"**, and a separate Proposal Currency.

**Report whether the built tab has any currency handling**, and whether the
catalog should carry a currency column or be USD by definition with conversion
happening downstream.

**Do not build currency conversion.** Report what the catalog's shape has to
allow.

### I5. Warranty

The prototype: **"10% of 21 units, rounded up, is 3 replacement units at 21,524
average."** Confirmed with the business.

**Report where the warranty percentage lives.** The prototype has it on
Structural Terms, per deal, seeded from a default. **Is there a catalog-level
default, or is it purely a deal field?**

**Report what the built screen does with the warranty line today** — it renders
`2% of 0 units = 0 units`, so a percentage is coming from somewhere.

**The separate-or-rolled-up choice is per deal.** Report where that setting
would live; it is not a catalog field.

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong six times in
sixteen rounds**, most recently a `contact_role_linked` risk aimed at a record
type the same brief excluded.

**This brief is written from two screenshots and a prototype.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The catalog: table, seed, `GET` route, per the I3 decision |
| 2 | The tab reads it |
| 3 | Full walk and close-out |

**Small, and it should stay small.** The tab already exists; this round gives
it numbers.

**Argue with it.** If I1 shows the tab has no calculation engine behind it,
Phase 2 is a build rather than a wiring change and the round grows.

---

## Verification requirements

**The tab must stop reading zero, measured with real units entered.** Enter
units, read the computed figures, and check them against the catalog by hand.
**A screen that renders numbers is not a screen that renders the right ones.**

**Establish Test Bed reachability rather than running a pixel check**, per the
standing change. Test Bed has its own Commercials tab with its own cost rates
typed per record, and whether this round touches it is the question.

**Test data may be deleted rather than migrated**, per the standing change. Any
existing typed cost values on Opportunity records are fixtures.

**Calibrate on the kind of change each phase makes**, and check the calibration
is in the right file. Round 34: *a calibrated search in the wrong file still
reads absent.*

**A removal is two claims** — the thing is gone, and what replaced it still
works. Round 35 Phase 5 made only the first and deleted three live routes.

**No probe prints a conclusion it has not computed.**

**Capture the whole run, never through a filter.**

**Enumerate teardown from the database by this round's tag, paged.** Round 35
Phase 5: *a teardown enumeration is a scan and carries every obligation a scan
carries.*

---

## Explicit non-goals

- **Pricing versions.** The snapshot on approval and the re-price as a new
  version. **Next, and the catalog's shape must support it.**
- **The Installation, Structural Terms and Payment Terms tabs.**
- **The pipeline panels** — Closed Won, unweighted, weighted, deals closing next
  two quarters, and the stage-by-region and industry-by-region matrices.
- **Industry on the Opportunity.** Confirmed with the business as coming from
  the Account and overridable, on the Customer Details panel. Not this round.
- **The sub-contractor pricing criterion**, confirmed as a Commercial-lens
  criterion at Solution Alignment. Configuration, not this round.
- **Renaming Record to Save on the Key Contacts panel**, and making it save
  every dirty row.
- **Currency conversion.**
- **The Risk assessment**, parked by the business.
- Round D, the truncation fix, the renderer and draft-store fork, Opportunity
  to Test Bed conversion, hosting for internal comment.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: is there a calculation engine behind the
   tab, or are the zeros markup.
3. **The I3 options**, with costs, not chosen.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
