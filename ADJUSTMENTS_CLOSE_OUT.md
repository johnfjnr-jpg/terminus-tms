# MINOR ADJUSTMENTS ROUND: CLOSE-OUT

Branch `adjustments`, from `main` at `7abb209`. Six findings from John's walk
2026-09-27, all six built.

---

## 1. THE SIX, AND THE EVIDENCE FOR EACH

| finding | state | evidence |
|---|---|---|
| **P1** the rule under the whole head, and the ink guard sees borders | built | red at 144/150, green at 150/150, injection FIRED |
| **P2** the panel widens from content, the milestone columns from S1 | built | measured before and after at 1920 |
| **P3** the note becomes a dot | built | assertion re-pointed to the dot, its text, and the prose's absence |
| **P4** autofill neutralised estate-wide | built | forced pseudo-class, both states measured, injection FIRED |
| **P5** "Proposal version" becomes "Approved version" | built | semantics unchanged, old label asserted gone |
| **P6** a Working version field | built | three states driven live 5/5, injection FIRED |

No guard was weakened. Nothing was demoted.

---

## 2. FIVE OF THE RULING'S PREMISES DID NOT SURVIVE MEASUREMENT

Recorded because a round that quietly absorbs a false premise teaches the next
one nothing.

**P4's history was wrong, and the truth is the better argument.** The ruling
said autofill was "never previously addressed". It was: `style.css:8482`, R1,
2026-09-13, with this exact technique, for six class selectors on leads and
contact surfaces. What was never done is making it ESTATE-WIDE, and the deal
panel was built afterwards. **Build discipline 6 for the fourth recorded
time.** It is why this round's rule enumerates `input`, `textarea` and
`select` rather than names.

**P6's "ONE version-label source" did not exist.** The same rule was
implemented four times, identically, as inline ternaries: `model.ts:48`,
`approval-page.js:862` and `:928`, `version-approval.js:304`. Adding a fifth
would have made the ruling's own sentence false. One module now holds it, the
four sites call it, and a test keeps it at one.

**P2 and P3 were ordered backwards, and the stylesheet said so.** The band was
stacked deliberately: "the responsibility select at 232px beside the lump sum
note at 320px made the band 568px, so the card was 602px and the pair
overflowed the panel by 180px at 1240". **The 320px was the note P3 removes.**
So P3 landed first and P2 became affordable.

**"Headless Chrome cannot be made to autofill at all" is false.** The R1 test's
own comment says it, and it is why that check was static.
`CSS.forcePseudoState` drives the real pseudo-class.

**P1's cause was a defect the previous round created.** The head band pinned
every head to one line box, with a comment justifying the pin by "each half is
its own grid"; R-US1 then made the cards share tracks by subgrid and R-US4
accepted a two-line heading. Premise re-taken, not re-weighed.

---

## 3. WHAT THE GUARD FOUND THAT THE WALK DID NOT

John reported the underline striking through "Cost/Mth". The border-aware ink
guard, run red-first, found **three**:

```
FAIL P1 no painted rule is struck through its own text:
     ig-head ig-num "Hosting cost/mth"                    5px past
     ig-head ig-num ig-install "Rate (USD, from Base C"  21px past
     ig-head ig-num ig-install "Margin %"                 5px past
```

The worst is the Rate heading, which is the very heading R-US4 accepted as
two-line. A walk finds what a reader sees; the guard found what a reader would
have seen next.

---

## 4. P2, MEASURED

```
band columns     320px             ->  232px 122.922px
lump cost group  top 1404 (below)  ->  top 1331 (beside)
install panel    399px             ->  413px, from its content
%       track 44px, input 30px, header ending 1058..1064
        ->  track 30px, header and input both ending at 1050
Amount  head track 36px vs row input 70px
        ->  both 1054..1124
```

**The Amount column was the subtle one.** R-US4 made it `max-content`, which
is right about what sizes a column and cannot make two SEPARATE grids agree:
`.cm-grid-head` resolved the word "Amount" and `.cm-grid-row` a 70px input.
`useTrackWidths` publishes one value both read, taken from the width S1 already
applied to the control, so the track is the control's width by construction.

---

## 5. P4, AND WHAT THE PROOF CAN AND CANNOT SIMULATE

**What it proves.** `CSS.forcePseudoState` puts a real element into the real
`:-webkit-autofill` state. Measured:

```
unstyled, forced      bg rgb(232, 240, 254)  black glyphs   <- the white box
the estate, forced    inset rgb(21, 22, 28)  rgb(242, 242, 240)
```

**What it does not simulate, stated plainly.** It does not fill the control. No
value arrives, nothing is typed, and Chrome's own decision to offer a
completion is never exercised. It drives the PSEUDO-CLASS, which is the only
thing the rule keys on, so it proves exactly the rule's claim and nothing
wider. A saved-credential path in a real profile remains untested here.

**One false red of mine on the way**, recorded because it is the shape this
estate keeps catching: the first assertion compared the raw token `#15161C`
against the computed `rgb(21, 22, 28)` and reported a defect that was not
there. The expectation now reads an ordinary input's computed style, which is
also the truer claim: an autofilled input should look like the inputs beside
it.

---

## 6. P5's FLAG

The field counts versions whose status is **issued**; the new name says
**approved**. Those are different events in this estate. The ruling directed
that the semantics be preserved under the new name, so they are, and this is
on the record rather than resolved silently in either direction.

The estate's own convention is sentence case throughout, so the labels read
"Approved version" and "Working version" rather than title case.

---

## 7. P6's UNSTATED FOURTH STATE

John gave three sentences. A record whose latest version is ISSUED and which
has NOT been edited since is a real state and is not among them. It reads as
the bare label, because both other "nothing has moved" states do and because
each suffix would say something untrue. **Asserted as a decision rather than
left as a default nobody chose**, and reported here as unstated rather than
presented as ruled.

---

## 8. CALIBRATION

| injection | verdict |
|---|---|
| P1 the strike-through regrown | FIRED, 6 failing |
| P4 the autofill override removed | FIRED |
| P6 a fifth copy of the label rule | FIRED, 3 failing |

Every reverted run GREEN, every restore byte-identical.

**P4's first injection could not score and the harness said so.** It re-pointed
the selector at `.zz-autofill-disabled`, a class in no markup, so the dead
selector guard caught it in **852ms against a live run's ~60s** - Verification
48's signature that the run never happened. FIRED-ELSEWHERE, not FIRED.
Re-pointed to remove the repaint while leaving the rule matching, it fires on
its own assertion.

---

## 9. MY OWN MISTAKES, EACH CAUGHT BY A CONTROL

- **A token compared against a computed colour**, producing a false red on a
  healthy estate.
- **`export { x } from` does not bind locally**, and `model.ts` calls
  `versionLabel` four times. The compiler said so four times.
- **A phantom class in an injection**, caught by a different guard.
- **Two traps the estate had already written down**: `api()` returns an
  envelope, and `catalogToRates` returns a wrapper whose `.rates` is wanted.
  Both are recorded at the new probe's own call sites.

---

## 10. WHAT THIS DOES NOT ESTABLISH

- **The autofill proof does not cover a real saved credential.** See section 5.
- **P1's guard checks an element's OWN text against its OWN bottom rule.** A
  neighbour's text crossing a rule is a different claim with a different fix
  and is not asserted.
- **`useTrackWidths` reads the rendered control**, so it is correct only while
  S1 is what sizes that control. If a track's control ever stops being
  S1-sized, the track follows it rather than the registry.
- **P6's field is computed from `pricingChanged`**, so an edit that moves
  nothing the pricing comparison can see is not an edit as far as the field is
  concerned. That is deliberate and matches the approval gate.
