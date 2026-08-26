# Key Customer Contacts

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 34 merged to `main`
at `0445b2d`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

The business compared Test Bed's buyer-role controls with Opportunity's and
asked for convergence. **Then withdrew the request**, and the reasoning is the
round:

> *"Ideally I would like to be able to add different contact / buyer roles
> within the opportunity. We know multi-threaded opportunities have a better
> chance of success, ie the sales people are talking to more people in the
> client organisation. Perhaps the buyer roles is important enough to have as a
> separate panel for opportunities. It's not the same as test bed. Perhaps we
> should be calling the panel Key Customer Contacts."*

**Four fixed slots and a list of people are different things.** Four slots say
there are four buyer roles, fill them in. A list says who are you talking to
and what part do they play, and it can hold two technical evaluators, or an
economic buyer who is also the champion, or eleven people at a large account.

**Multi-threading is measurable in a list and invisible in four slots.** Four
slots with three filled read the same whether the deal knows three people or
thirty.

**And it connects to something already configured.** Round 33 configured
Champion identified, Buying committee mapped, Internal pain owner and Economic
Buyer identified as Organisational criteria. **Those criteria ask about people
and the panel has nowhere to put them.**

---

## What the screenshots show

| | Test Bed | Opportunity |
|---|---|---|
| Select | Full width, "Select a contact" readable | **Truncated to "Sel"** |
| Actions | `+ NEW` | `LINK` and `+ NEW` |
| Roles | Three: Comm, Tech, Legal | Four: Technical, Commercial, Legal, IT / Security |
| Panel | Inside Customer Details | Inside Customer Details |

**"Sel" is the truncation defect in its worst form** — the select is squeezed
to roughly 40px, so the control is unreadable without clicking it. Round 34
diagnosed the general case: the display wraps and the input does not.

---

## Decided with the business

| | |
|---|---|
| **The panel** | Its own panel, named **Key Customer Contacts**. Not inside Customer Details |
| **The model** | A **list of people**, each with a role and a stance. Not fixed slots |
| **Roles** | A **configured list**, admin-editable, the way `closed_lost_reasons` and `scoring_lenses` are |
| **The ten** | Executive Sponsor, Champion, Technical Buyer, Commercial Buyer, Procurement, Legal, IT, Cyber Sec, QHSE, DPO. **A minimum, expected to grow** |
| **Stance** | A second field. Role is the function, stance is where they stand |
| **Inline creation** | A new role can be created from the panel, **with a system-wide effect confirmation** |

### Why role and stance are separate

**The ten are not all the same kind of thing.** Executive Sponsor and Champion
are stances; Procurement, Legal, IT, Cyber Sec, QHSE and DPO are functions.

**With role alone, a champion who is also the technical buyer takes two rows.**
With both, one person is one row carrying two facts.

**And stance is what the Organisational lens is scored against.** Champion
identified asks whether someone is advocating. Political dynamics and Buying
committee mapped ask about stance across the committee. **Role alone cannot
answer any of them.**

### Why inline creation needs the confirmation

**There is a precedent and it is close.** The Use Case Curation design carries
an Industry escape valve: create inline, with a **system-wide effect
confirmation**, because adding a row to a shared vocabulary from inside one
record changes every record.

**Without it the list degrades into free text with extra steps** — "Head of IT"
created while "IT" exists, then "Cyber Sec" and "Cybersecurity" and "InfoSec"
arriving over six months.

**With it, the list grows as real organisations are met**, and each addition is
a deliberate act someone can see.

---

## What this replaces, and what it does not

`OPPORTUNITY_DESIGN.md` records the current model as an interim: *"Buyer role
catalog: structured design confirmed as future scope; current model is
mandatory core roles — Commercial, Technical, Legal — plus a free-text escape
valve."*

**This is that structured design**, arriving from the business rather than from
the design record.

**Test Bed is not in scope.** The business: *"It's not the same as test bed."*
Test Bed's three-slot model stays as it is.

---

## Investigations

### I1. What the four slots are today

**The question.** How are Technical, Commercial, Legal and IT / Security Buyer
stored, and what reads them?

Report the payload keys, whether they hold a contact id or a name, what `LINK`
does that the select does not, and whether the select is scoped to the
account's contacts.

**`LINK` is the control that decides whether this round removes a capability.**
If the select is account-scoped and `LINK` attaches a contact from outside the
account, removing it removes the escape hatch for a partner or an intermediary.
**Report what it does; do not decide.**

### I2. `contact_role_linked`

**The question.** Round 20 found a `contact_role_linked` requirement type in
`stage_gate_rules`. **What names it, and what would a list model do to those
rules?**

Report every rule of that type, per record type, and what each requires. **A
gate requiring "a Contact linked as Client Commercial Buyer" against a fixed
slot is a different rule from one against a list.**

**This is the round's real risk.** The gates are live and the business's own
records satisfy them.

### I3. The precedent for a configured vocabulary with inline creation

**The question.** What exists already?

`closed_lost_reasons` from Round 21 is the nearest configured-list precedent:
admin-editable rows, `GET`-only, seeded by migration, uuid-referenced, with an
`active` flag so retiring a row does not break records citing it.

**The Industry escape valve is the inline-creation precedent.** Report whether
it is built or designed, and if built, what its confirmation says and does.

**Report what "admin-editable" means today.** `PROTOTYPE_SPECIFICATION.md`
Section 7 marks Admin as out of v1 scope and not extracted, so a configured
list may be admin-editable in principle and database-editable in practice.
**Say which.**

### I4. Where the panel goes

The Reference tab now carries Terminus Details, Customer Details and Key Dates.
Round 34 made Customer Details nine rows with the six-field proposal address.

**Report what a fourth panel does to the grid**, measured at 1240, 1920 and
3440. Round 31 Phase 1 found the grid is `auto-fit, minmax(280px, 1fr)` and
Round 21's own comment describing a 2-up grid is 3 columns at 1920.

**Report what a variable-length list does to a fixed grid.** Three panels are
each a known height; a list of eleven contacts is not.

### I5. The stance vocabulary

**Not decided, and this phase proposes rather than chooses.**

Role is settled at ten. **Stance is not.** Report a proposal for the business
to correct, and say what each value would mean.

**The Organisational criteria are the test.** If the stance values cannot
answer Political dynamics or Buying committee mapped, they are the wrong
values.

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong five times
in fourteen rounds**, most recently a hover defect filed against the wrong
screen and a claim that `refFieldRow` was shared with Accounts.

**This brief is written from two screenshots and a conversation.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The roles vocabulary: table, seed, `GET` route |
| 2 | The stance vocabulary, per the I5 decision |
| 3 | The panel: list, add, remove |
| 4 | Inline role creation with the system-wide confirmation |
| 5 | The four slots retired, per the I2 finding |
| 6 | Full walk and close-out |

**Phase 5 is last deliberately.** The gates are live and the business's records
satisfy them, so the new panel should work before the old model is removed.

**Argue with it.** If I2 shows the gate rules cannot express a list, Phase 5
becomes a decision rather than a build and may be its own round.

---

## Verification requirements

**Every measurement filtered on visibility.** Round 34 found the Opportunity
page carries 61 `.ref-field` rows of which 21 are visible, the rest Test Bed's
in the same document.

**A list is not a fixed panel.** Measure it empty, at one, at four and at
eleven. Round 33 measured a lens at eight because that was the largest real
count; a contact list has no ceiling.

**Waits must be counterfactual-safe, and mark a child rather than the
container.** Round 34 Phase 6 found `innerHTML` replacement preserves the
element and its attributes, so a mark on the container survives the re-render
it was placed to detect.

**Success may be the absence of a signal.** Round 34 found
`performGenericRefSave` writes feedback only on failure and re-renders on
success.

**Calibrate on the kind of change each phase makes**, and check the calibration
is in the right file. Round 34 Phase 0: *a calibrated search in the wrong file
still reads absent.*

**No probe prints a conclusion it has not computed.**

**Capture the whole run, never through a filter.**

**Test Bed pixel-identical.** This round is Opportunity-only and Test Bed's
three-slot model is explicitly out of scope.

**Enumerate teardown from the database by this round's tag.**

---

## Explicit non-goals

- **Test Bed's buyer roles.** Out, on the business's own statement.
- **The truncation fix.** Round 34 diagnosed it: the display wraps and the
  input does not. It touches four screens and belongs in its own round.
  **"Sel" disappears here as a side effect of replacing the control, not as a
  fix.**
- **The Admin module.** Section 7 is out of v1 scope. This round produces a
  configured table, not a screen to edit it.
- **Round D**, the Risk assessment, the renderer and draft-store fork, where an
  Opportunity's industry comes from, Opportunity to Test Bed conversion.
- The three-string vocabulary reconciliation, `measurabilityConfirmed`, the
  app-wide `<p>` reset, the Closed Lost hover wording, reopening a loss, the
  open-decisions convention, the approval snapshot.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer on `LINK`**, stated plainly: does it do something the select
   does not.
3. **The I2 finding**, with every affected gate rule named.
4. **The I5 stance proposal**, for the business to correct.
5. **The phase plan**, with the argument for any departure.
6. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
