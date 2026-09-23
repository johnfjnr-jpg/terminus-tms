# Step 1: the census, and why Step 2 stops for a ruling

**Nothing is built. The census is complete and calibrated, and it found two
families of blank control, not one. The second is a decision an earlier round
took deliberately, and this round's instruction reverses it.**

Branch `dealsheet-3` at `126959e`, off `main` `e6a3499`, confirmed equal to
`origin/main` by `ls-remote`. No Superpowers skill active; rule 18 and build
discipline 19 govern.

---

## THE CENSUS

Five surfaces, both widths, on records the session user OWNS and that were
populated through the real routes. Every blank box is answered from three
independent sources, none of them the box itself: the single derivation, a
field row's own display half, and the record payload.

```
                         controls  editable  field rows  blank-with-a-value
opportunity commercials      166        66           1        22
opportunity reference        166         7          21         0
contact detail                17        16           1         0
test bed reference            22         6          19         0
test bed commercials          15         2          13         0
```

Identical at 1440 and 1240. 110 field-row editors were opened in turn, because
a field row keeps both halves in the document and only one row opens at a time,
so a scan of the closed surface can never see an editor.

**Every blank is on one surface: the opportunity Commercials tab.**

### FAMILY A, the statement drawers. 14 controls. This is John's screenshot

| control | effective value | the box shows |
|---|---|---|
| `stmt-edit-deal-margin-hwSs` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-price-hwSs` | 365,714 | empty, no placeholder |
| `stmt-edit-deal-margin-hwAqm` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-price-hwAqm` | 11,429 | empty, no placeholder |
| `stmt-edit-deal-margin-hwHemir` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-price-hwHemir` | 428,571 | empty, no placeholder |
| `stmt-edit-deal-margin-inLump` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-price-inLump` | 285,714 | empty, no placeholder |
| `stmt-edit-deal-margin-hoSs` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-hofee-hoSs` | 9,143 | empty, no placeholder |
| `stmt-edit-deal-margin-hoAqm` | 29.9 | empty, no placeholder |
| `stmt-edit-deal-hofee-hoAqm` | 571 | empty, no placeholder |
| `stmt-edit-deal-margin-hoHemir` | 30.0 | empty, no placeholder |
| `stmt-edit-deal-hofee-hoHemir` | 2,143 | empty, no placeholder |

**The mechanism is one line**, `DealStatement.tsx:74`:

```tsx
value={seam.values[id] ?? ''}
```

`seam.values` holds what was STORED. A line at target margin has no override
stored, so the lookup misses and the `?? ''` renders blank. **The derivation is
never consulted**, though it is already computed and already on the screen four
lines away as the line's own price.

The screenshot is `.verify/dealsheet3/drawer-before-1440.png`, opened and read:
SafeSight shows a $256,000 cost, an empty Margin % and an empty Price, while
Hardware price totals $815,714 directly beneath.

### FAMILY B, the old pricing cards. 8 controls. THIS IS THE STOP

| control | effective value | the box shows |
|---|---|---|
| `deal-margin-hwSs` | 30.0 | empty, placeholder `30` |
| `deal-margin-hwAqm` | 30.0 | empty, placeholder `30` |
| `deal-margin-hwHemir` | 30.0 | empty, placeholder `30` |
| `deal-margin-hwWarranty` | **0.0** | empty, placeholder **`30`** |
| `deal-margin-inLump` | 30.0 | empty, placeholder `30` |
| `deal-margin-hoSs` | 30.0 | empty, placeholder `30` |
| `deal-margin-hoAqm` | **29.9** | empty, placeholder **`30`** |
| `deal-margin-hoHemir` | 30.0 | empty, placeholder `30` |

**These are blank on purpose, and the reason is written at the site**
(`section4.tsx:272`):

> B8/B9: a BLANK box prices at target, so the placeholder carries the target
> rather than the box carrying a value nobody entered. An overridden line says
> so, because a line priced away from target is a decision.

It cites the prototype at `opportunity-deal.js:379-385`. **Blank is the
meaning**: it says "this line is not a decision, it follows target". Filling
those boxes with 30.0 would delete the distinction between a line that follows
target and a line somebody deliberately set to 30.

---

## THE CONFLICT, NAMED RATHER THAN RESOLVED

This round's instruction says:

> a control displays the effective value it represents ... clearing returns to
> the derived display, never to blank

**Applied to family B that reverses B8/B9.** Verification 23 is exactly this:
two correct decisions about the same question taken in different rounds, each
defensible on its own terms, with nothing in either one knowing the other
exists. Its rule is that the conflict is reported, and that the answer is
deletion rather than reconciliation: one has to become a caller of the other.

**And the old pricing cards are already retirement-bound.** C2's brief kept
them explicitly: "the old matrix disclosure stays as is, retirement decided at
C3." Changing the semantics of a surface due for retirement, against a written
ruling, is the move most likely to be regretted.

**My recommendation, which is yours to take or reject:**

1. **Build family A now.** It is unambiguous, it is your screenshot, and no
   prior decision covers it. The statement drawers were built this month and
   the `?? ''` is an oversight rather than a position.
2. **Leave family B to C3's retirement.** If the cards survive C3, the blank
   question is re-taken then with B8/B9 on the table.

---

## AND ONE THING IN FAMILY B IS WRONG UNDER EITHER DECISION

`deal-margin-hwWarranty` carries the placeholder `30` and the warranty line
prices at **0.0%**. `deal-margin-hoAqm` carries `30` and its line prices at
**29.9%**.

The placeholder is `String(target)`, the deal's target margin, on every row.
B8/B9's claim is that a blank box prices at target, so the placeholder is
honest. **For the warranty line it is not**: the statement shows that line at
`0.0%` and `$10,000`, visible in the same screenshot, four rows below a box
promising 30.

That is a small, self-contained correctness defect inside family B, and it is
the one part of family B I would fix whatever you rule about the rest.

---

## TWO INSTRUMENT FAULTS, BOTH CAUGHT BEFORE ANY RESULT WAS BELIEVED

Recorded because each produced a confident, wrong, clean-looking answer.

**1. The census read 0 editable controls on every surface at both widths.**
That is a null reading, so it was calibrated rather than read (Verification
13). The funnel:

```
all controls 185    enabled 47    visible 5    both 0
```

The five visible were all read-only; the 47 enabled all belonged to other
views. **The page said why in a banner the scan never read:** `READ ONLY,
ANOTHER USER'S RECORD`. The session user owns **0 of 18 opportunities, 0 of 17
contacts, 0 of 11 test beds** - the whole estate belongs to `john@` - so the
ownership door had correctly neutralised every write control, and the census
was measuring the door rather than the defect.

**A census of editable controls run against records the session cannot edit
returns zero for a reason that has nothing to do with the claim.** It now
creates its records the way the system creates them (Verification 47).

**2. The tab click landed on the wrong strip.** The opportunity view carries an
approval-TRACK tab named `Commercial` beside its panel tab `Commercials`.
Clicking `Commercial` switched the track and left the Reference panel showing,
and the census reported the same 7 controls for both tabs and called it clean.
Scoped to the visible view and named correctly, the same surface reads 66.

---

## CALIBRATION, ALL THREE BRANCHES, BOTH DIRECTIONS

| branch | healthy | injected |
|---|---|---|
| derivation | **fires 22 times** (the finding) | n/a, it fires on the real estate |
| display half | 0, on 110 opened editors | **6 of 6** |
| record payload | 0 | **4 of 4** (`deal-duration` 60, `input-name`) |

The display-half and record branches had each reached a population and reported
nothing, which is indistinguishable from being unable to report. Under
`C_CALIBRATE=1` a populated editor is blanked in the DOM, which is precisely
the state each branch claims to detect, and each fires.

---

## WHAT THIS CENSUS DOES NOT ESTABLISH

1. **It is one record per type, not the estate.** The claim is about a defect
   CLASS and the class is now located; it is not a count of affected records.
2. **The test bed commercials rows are all legitimately unset**, so that
   surface contributes no evidence either way. A fresh test bed has nothing
   recorded, and none of its 13 rows could be injected for the same reason.
3. **Leads was in your list and has nothing to census.** `GET /api/leads` is a
   read-only legacy view over `record_type='lead'`, and there are **zero such
   rows**; new intake happens through Contacts. The New Lead grid is a CREATION
   surface, where a blank box is correct by definition.
4. **The record branch is proven as a mechanism, not on every surface.** No
   populated direct control was available to inject on the two test bed
   surfaces.

---

## WHAT I NEED FROM YOU

One ruling: **family A only, or both families.** If both, I will need you to
say explicitly that B8/B9 is superseded, because the fix deletes the
distinction between a line following target and a line set to target, and that
distinction is the reason the blank was chosen.

Family A, the `hwWarranty` placeholder, the estate-wide red-first guard, the
live proof at both widths, and the database read-back are ready to build on
your word.

Nothing is pushed from the session.
