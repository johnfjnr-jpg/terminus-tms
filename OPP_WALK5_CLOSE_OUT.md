# Opportunity walk round (walk 5): close-out

Branch `opp-walk5`, off `main` at `85ad44c`, confirmed equal to `origin/main`
by `git ls-remote` rather than by the local tracking ref before the branch was
cut. Rule 18 governs and nothing is pushed from the session.

---

## 1. The rulings, and where each landed

Counted against **the rulings**, not against the brief's headings.

| | Ruling | Commit |
|---|---|---|
| **R-W1** | "Latest first" removed estate-wide; the count joins the line as "2 of 3"; the rungs shorten to 2 / 10 / All; the full line fits with no wrap and no clip at both widths | `96b8b60` |
| **Layout set** | W2, W4, W5, W6-W9, W10, W13, released on the Phase 0 report | `c37205e` |
| **R-W12** | The customer milestone column becomes the prototype's dropdown from the same constant the contractor grid uses; the false comment corrected; the vocabulary table recorded, not built | `4dede80` |
| **R-W3** | The picker filters to the linked account; the server refuses an out-of-account contact with a named reason; a no-account opportunity explains its empty picker | `f1fb4a9` |

Plus the brief (`50936ec`) and Phase 0 (`bba4b88`). **Six commits, four ruling
groups, and W11 was context rather than a build item.**

---

## 2. The two findings Phase 0 stopped for, and what the rulings did with them

**W1 did not fit by 148px at 1440 and 222px at 1240.** The ruling did not
overrule the measurement, it changed the inputs: removing the secondary and
shortening the rungs is what bought the room back, and the line now measures
one row at both widths with nothing clipped.

**W12 asked whether named milestones were lost.** They were not. The
prototype's six survive as `CONTRACTOR_MILESTONES`, the installation grid
never lost its dropdown, and the customer grid has never held a row in any
live opportunity. The ruling reconnected the control to the vocabulary that
was already there.

---

## 3. WHAT I GOT WRONG, AND WHAT CAUGHT IT

This round found more faults in my own work than in the product. Each is
recorded where it happened as well as here.

### Phase 0 reported a server gap that did not exist

R-W3's brief says the server must refuse an out-of-account contact. **It
already did, and had since Round 35** - a named 422, about a hundred lines
below where I read. My Phase 0 saw `ownedOpportunity` select `account_id`,
saw no comparison near it, and reported that nothing validated the contact.

I added a check. **The calibration then showed the refusal working without
it**, which is exactly what a duplicated rule looks like. The duplicate was
removed rather than kept: two enforcements of one rule drift, and these two
already disagreed about the status code, 409 against 422.

**The silence is what found it**, on a control that looked correct.

### Two probe measures reported ONE LINE on a wrapped header

The first read `head.children`, which on the Panel path is the title and the
action group - and the wrap was INSIDE the action group, so the two top-level
children still overlapped. **A container cannot report its own children
wrapping.**

Flattened to the leaves, the overlap test still passed: "2 of 5" spanned
466..487 and "Notes" 483..501, two lines that TOUCH by four pixels. **One line
is a shared CENTRE, not a bare overlap.** Corrected, it went red on all six
surfaces, which is the red-first the ruling needed.

### A CSS comment broke its own block, twice

An orphaned terminator and five lines of prose outside a comment silently
swallowed the rule below: the installation fields went on measuring 144px
while the stylesheet said 104. **Then the note describing that did it again**,
by quoting the terminator literally inside a comment.

**A count of openers and closers called the file balanced both times.** Walking
the PAIRING found each one. The hybrid group spent a run rendering as a single
753px column for the same reason, with both panels stacked and nothing
erroring.

### A W13 assertion was a tautology

`.ms-grid-row` stretches to fill its panel, so "panel width equals grid width"
can never fail - it read 375/375 before the injection and 453/453 after it.
**A calibration silence named it.** It compares the panel's edge to its last
COLUMN now. The W10 injection in the same run was mis-aimed, removing an
alignment class where the check is about column placement.

### Two screenshots were pure background and every check passed on them

`.is-loading > *` hides children while PRESERVING layout, so the grid reported
top 455 in a 1200px viewport and the picture showed nothing. The capture guard
asserts visibility now, not only position.

### And a syntax error took the whole server down

The R-W3 check declared a `contactErr` the handler already had. Every route
was down, not just that one, and the next probe reported ECONNREFUSED rather
than a product failure.

---

## 4. Evidence per ruling

| Ruling | Live proof | Calibration |
|---|---|---|
| R-W1 | 46/46 on three surfaces at 1440 and 1240 | the corrected one-line measure went red on all six before the fix |
| Layout set | 44/44 at both widths, every claim a relationship between two elements | **7/7** |
| R-W12 | the column is a select, offers six plus the placeholder, matches the contractor grid | **5/5**, plus five react tests |
| R-W3 | 11/11: picker scoped, in-account add read back from the database, out-of-account refused by REASON, nothing written | **6/6**, both halves injected separately |

---

## 5. One departure, stated

**Sizing the WHT box to the ruled two digits clipped the contract's own
absence wording to "not recorde".** The ruled WIDTH is kept and the WORDING
gives way: that field alone reads `--`. GST sits on the same card and is not
narrow, so it still reads "not recorded". If those should match, it is a
decision about wording rather than about this field's size.

---

## 6. Carried, not built

1. **The vocabulary table for project milestones**, recorded on the constant
   per R-W12. The estate already has that pattern four times over.
2. **The milestone USD has two readers** (raised at Phase 0, reasoned from
   source and NOT measured).
3. `#ref-vanilla`'s eleven ids.
4. `ref-save-feedback`'s dual naming.
5. The orphaned `.tab-action-idle` rule.
6. `input.input-invalid` with no applier.
7. **O1** from walk 4, still deferred.

---

## 7. Exit gate

| Point | Answer |
|---|---|
| Every finding built, ruled or recorded | Yes, section 1 |
| Rulings appended at the phase they launch | Yes, in the brief and at each site |
| Every new guard calibrated both directions | Yes, section 4 |
| Live proof at 1440 and 1240 | Yes, every tier |
| Read back from the database where a write is involved | Yes, R-W3's in-account add |
| Screenshots opened and read | Yes, and they found the clipped WHT placeholder and two blank captures |
| Fixtures torn down, re-queried | Yes: **zero live records owned by the probe account** |
| `CURRENT_STATE.md` regenerated and reconciled | Section 8 |
| Full gate with `--round-close` | Section 8 |
| Merged or pushed | Merge only on an all-green gate; **no push from the session** |

---

## 8. `CURRENT_STATE.md` and the gates

### Regenerated and reconciled

Regenerated at `5e49353` on a clean tree, so it carries no
`(working tree dirty)` marker. Twenty-four lines changed and **every one is a
row count**: live stays at 132 in every row, which agrees with the residue
query, soft-deleted grew as a soft delete does, and the two tag distances moved
by this branch's commit count. **No configuration row changed.**

### The branch gate, verbatim

Run as the final act on the final committed tree, nothing else running, tree
clean, no `(WORKING TREE DIRTY)` marker, every duration in its normal band.

```
MERGE GATE  opp-walk5  6ed15a9c9cb1f650072ff938feba8624b7a0d6b1
  PASS  reachability               exit 0  99ms
  PASS  session precondition       exit 0  1026ms
  PASS  pure suite                 exit 0  4165ms  623/623 pass, 0 fail
  PASS  database suite             exit 0  122261ms  105/105 pass, 0 fail
  PASS  react typecheck            exit 0  616ms
  PASS  react suite                exit 0  15692ms  1276/1276 pass, 0 fail
  PASS  react bundle freshness     exit 0  604ms
  PASS  HTTP precondition probe    exit 0  25837ms
  PASS  HTTP version-approval probe exit 0  31592ms
  PASS  HTTP pricing-approval probe exit 0  26029ms
  PASS  HTTP review-closes probe   exit 0  30412ms
  PASS  HTTP term initial-value probe exit 0  62714ms
  PASS  HTTP stage-probability probe exit 0  14153ms
  PASS  HTTP version-gate probe    exit 0  29770ms
  PASS  HTTP no-freeze probe       exit 0  24607ms
  PASS  HTTP version-order probe   exit 0  20771ms
  PASS  HTTP commercial-gate probe exit 0  32852ms
  PASS  HTTP readonly-view probe   exit 0  64335ms
  PASS  CURRENT_STATE staleness    exit 0  156ms
  PASS  browser dependency is functional exit 0  704ms
  PASS  HTTP write success probe   exit 0  31520ms
  PASS  HTTP issue-target probe    exit 0  27161ms
  PASS  HTTP proposal-issued probe exit 0  38049ms
  PASS  HTTP zero-track transition probe exit 0  17243ms

All 24 stages passed.
```

### The merge

`main` was confirmed equal to `origin/main` at `85ad44c` **against the real
remote** with `git ls-remote`, not against the local tracking ref, and the tree
was clean. Merged `--no-ff` with **no conflicts**. Merged `main` is
`d262eaa19bab10a89b72092a2d442f1b22715eaf`, and `6ed15a9` is confirmed an
ancestor of it.

The dev server was killed and restarted from merged `main`, and was proven to
be serving the MERGED code rather than assumed to be: the new installation-grid
rules in the stylesheet and the no-account note in the bundle. A stale server
is the one fault a probe cannot notice about itself.

### The merged-tree gate, verbatim

```
MERGE GATE  main  d262eaa19bab10a89b72092a2d442f1b22715eaf
  PASS  reachability               exit 0  97ms
  PASS  session precondition       exit 0  991ms
  PASS  pure suite                 exit 0  4239ms  623/623 pass, 0 fail
  PASS  database suite             exit 0  123955ms  105/105 pass, 0 fail
  PASS  react typecheck            exit 0  634ms
  PASS  react suite                exit 0  15719ms  1276/1276 pass, 0 fail
  PASS  react bundle freshness     exit 0  608ms
  PASS  HTTP precondition probe    exit 0  22268ms
  PASS  HTTP version-approval probe exit 0  28235ms
  PASS  HTTP pricing-approval probe exit 0  33665ms
  PASS  HTTP review-closes probe   exit 0  30485ms
  PASS  HTTP term initial-value probe exit 0  62010ms
  PASS  HTTP stage-probability probe exit 0  16566ms
  PASS  HTTP version-gate probe    exit 0  32585ms
  PASS  HTTP no-freeze probe       exit 0  24203ms
  PASS  HTTP version-order probe   exit 0  20727ms
  PASS  HTTP commercial-gate probe exit 0  31806ms
  PASS  HTTP readonly-view probe   exit 0  73043ms
  PASS  CURRENT_STATE staleness    exit 0  265ms
  PASS  browser dependency is functional exit 0  697ms
  PASS  HTTP write success probe   exit 0  24040ms
  PASS  HTTP issue-target probe    exit 0  26726ms
  PASS  HTTP proposal-issued probe exit 0  38453ms
  PASS  HTTP zero-track transition probe exit 0  18146ms

All 24 stages passed.
```

**THIS SECTION'S OWN COMMIT IS MARKDOWN ONLY AND RIDES THAT GATE**, named here
as build discipline 48(a) requires: it touches one file no gate stage reads.

**Ready for John's push: `d262eaa19bab10a89b72092a2d442f1b22715eaf`.**
Nothing was pushed from the session.
