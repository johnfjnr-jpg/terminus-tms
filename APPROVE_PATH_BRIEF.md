# Approval-path defect round

Branch `approve-path`, off `main` at `bf33143bdbb527e1fd4bac820988274154b7c011`,
confirmed equal to `origin/main` by `git ls-remote` against the real remote.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push"
and nothing is pushed from the session.

---

## John's walk findings, 2026-09-25, verbatim

> the "Approval view" button DOES NOTHING when pressed; a minor version cannot
> be raised to a major from the screen; a fundamental input change must revert
> pricing to the derived calculation.

## The rulings, verbatim

> **H1:** the button works and is renamed "Approve pricing" (button vocabulary:
> verb, sentence case per estate standard); it leads to the approval flow for
> the current pricing. Rename asserted across all its occurrences.
>
> **H2:** the issue path is reachable and complete from the screen: a draft can
> be issued and the panel shows the promotion (0.x -> 1.0), with the route's
> existing guards (next-version rule, no-delta refusal) surfacing their messages
> in the UI rather than silently.
>
> **H3 (R-REV, John's ruling as recommended):** when a FUNDAMENTAL input changes
> - unit counts (all four), and any input the derivation multiplies quantities
> by - the ABSOLUTE overrides (priceOverrides, hosting fee overrides) CLEAR, so
> those lines return to the derived calculation and their amber disappears;
> MARGIN overrides persist (a ratio remains a decision). The clear happens on
> the same save that changes the input, is visible immediately, and the DB
> read-back proves the override keys removed. Guard both directions: a count
> change clears absolutes and leaves margins; a non-fundamental edit clears
> nothing. If John rules "clear all" instead, margins clear too - build to this
> brief's H3 unless the paste is amended.

---

## PHASE 0: THE MECHANISMS, MEASURED BEFORE BUILDING

**The audit drove routes and found them conforming. This drove buttons.** Those
are two populations and the audit's green said nothing about this one.

### F1. The button is UNBOUND, and the view behind it works

```
btn-save-version               "Save version"                react handlers: onClick
btn-issue-version              "Save a new version to issue"  react handlers: onClick
btn-request-pricing-approval   "Request approval of V0"       react handlers: onClick
btn-open-approval              "Approval view"                react handlers: NO on* PROPS
```

It is a bare `<button>` carrying an id and a class. **Nothing anywhere binds a
listener to that id** - the only other references in the repository are two
probes that check whether it is VISIBLE.

Clicked as the owner: **view unchanged, no `/api` request, no error.** It does
exactly nothing, silently.

**And the destination is fine.** Reached directly with
`navigate('opportunity-approval', id)` the view renders
`COMMERCIAL APPROVAL | TT-SGP-AIRPRT-9407 | ... priced at revision ...`. So
this is a missing binding, not a broken screen, and the fix is small.

**Verification 4's own sentence, arriving in two committed probes**:
`probe-version-actions.mjs` asserts this button's VISIBILITY, and visibility is
exactly what a dead button has.

### F2. The issue control is HIDDEN, not missing, and not disabled

After a real Save version through the screen:

```
ladder            0.1/draft
the panel shows   V0.1 draft
the issue control "Issue V0.1 as V1"  visible=FALSE  disabled=false
                  title="Issues V0.1 as V1. Earlier drafts can be restored, not issued."
```

**It knows exactly what it would do and cannot be seen.** The mechanism is one
clause: `className={...}${gateApplies ? '' : ' hidden'}`, where `gateApplies`
is `window.oppVersionGateApplies()`, which is true only when the record's stage
tracks include one with `scope === 'version'`.

**So on any stage without a version-scoped approval track - Qualification, where
a deal is first priced - there is no way to issue at all.** That is John's
"a minor version cannot be raised to a major from the screen", exactly.

### F3. Nothing clears an absolute override, and nothing ever has

Driven on the live screen: a price override, a hosting fee override and a margin
override stored, then the SafeSight existing-infra count changed 20 to 35.

```
before   priceOverrides {"hwSs":500000}  hostingUnitFees {"hoSs":99}  marginOverrides {"hwAqm":44}
after    priceOverrides {"hwSs":500000}  hostingUnitFees {"hoSs":99}  marginOverrides {"hwAqm":44}
amber    unchanged, all three lines
```

**The absolutes SURVIVED the count change.** There is no clearing mechanism
anywhere in the estate to repair - this is new behaviour, not a broken one.

**Why it matters, in the deal's own terms:** a price override is a figure for a
quantity. Change the quantity and the stored figure silently prices a different
deal, while the amber goes on claiming somebody chose it.

### A fourth thing, noted and not built

`btn-request-pricing-approval` reads **"Request approval of V0"** - a third
label format, alongside the panel's `V1` and the server's `V1.0`. That is the
unruled label question from the lifecycle audit and it is not touched here.

---

## SCOPE IS UNCHANGED, so the round proceeds

All three findings are as John described, each has a single named mechanism, and
none is larger than the brief assumed.
