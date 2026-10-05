# LABEL_CONTRAST Phase 2: STOP, the approved fix rested on my wrong diagnosis

## 1. Not done

**Unresolved:** one squeeze this round created. At 1240 the units-and-installation section needs
882px of the 876px available, so the Installation card sits about 6px past its section edge.

**Waiting on the ruling in section 3:**

- the full gate;
- the merge and the merged gate;
- the ls-remote re-check.

Nothing is pushed.

## 2. Done and evidenced (branch `label-contrast`, latest `c603370`)

| item | evidence |
|---|---|
| **C1** `--muted` 0.50 to 0.75 | Census on the build: **522 enabled quiet text nodes 7.69 to 9.40:1** (were 2.63 to 4.83). White figures 13.5 to 16.1:1. The 4 below 7 are disabled buttons, at 3.26, and dimmer by design |
| **C2** inline `--muted-2` to `--muted` | six sites in `cashflow.ts` and `panelParts.tsx`. **G9 4** now scans the React source and the vanilla scripts (comments stripped). **G9 5** calibrates the matcher: it fires on four routes and stays silent on a fill. Restoring one old site turned G9 4 red, naming `panelParts.tsx`; the file was restored byte-identical |
| **S1** `--field-label-size` 12px | the 5 token rules |
| **S2** five label rules on the token | `.label`, `.cf-row.head .cf-label`, `.ohl-label`, `.tp-chip`, `.tp-tag` |
| **Units grid "UNITS" head** | **The cause was a measurement.** The track's width came from a canvas, which ignores letter-spacing: 36px measured against 42 painted at 12px (31.5 against 37 at the old size). The tracking is now included and the squeeze is gone. This also clears the pre-existing units-head squeeze you queued, which had the same root |
| **P1 disabled** | every disabled control is **2.67 to 2.94 times** dimmer than its enabled form (floor 1.5). Save settings: 3.27 disabled against 9.16 enabled. Start-year select: 5.2 against 15.29. Follow-up Save, Request next stage, Save a new version, Save changes: about 3.26 against 8.7 to 9.05. Screenshots `lc-p2-save-*`, `lc-p2-start-year-*` (with `lc-p2before-*` for the old tokens) |
| **P2 active** | **nav:** 11.67 against 9.4, colours 1.71 apart, plus a background and an underline. **Tabs:** 15.29 against 9.05, 1.71 apart, plus the green underline. **Stage strip:** 8.92 apart, plus fill and border. Screenshots `lc-p2-nav`, `lc-p2-tabs`, `lc-p2-stage-strip` |
| **Overlap sweep** | Term Pricing and the OPEX card, 1240 to 1920 step 40: **3096 / 3096** |
| **Goldens** | 78 / 78; `npm run goldens` `PASS: 9 checks, 4734 figures exact.` |

**Two instrument faults, mine, caught before any claim was made:**

1. **The first P1 run ignored element opacity.** Every disabled button also carries
   `opacity: 0.5`, so the run read a disabled Save as bright as an enabled one, a false STOP. Both
   instruments now multiply opacity down the ancestor chain, and the census was re-run, since a
   label inside a faded container would otherwise have been credited with false contrast.
2. **My preview re-captured its "before" state on every run.** Once Phase 2 landed, it overwrote
   the committed pre-change screenshots with the changed screen. The edit journal refused the
   commit; the files were restored to their committed bytes and the script no longer does it.

## 3. THE STOP

**In Phase 1 I said the 6px squeeze at 1240 came from the "UNITS" head, and you approved widening
that column. Measured now, with the units head fixed, the squeeze is still there.**

**The real cause is the "LUMP SUM COST" label in the Installation card's heading.** It is a
`.form-group label`, one of the five token rules, so it went to 12px.

- The heading lays out its groups as `max-content` columns, so the lump-sum column is as wide as
  the label's one-line width: 123px became 138px.
- That heading was already wider than its grid track before this round (379px in 365px), one of
  your four queued squeezes. The extra 15px pushes the whole section past its edge.

A comment beside that rule records the same mistake once before: "`max-content` measures the
prose, not the fields".

**The decision rested on a premise that has failed, so I have not quietly re-planned it
(Verification 29).**

**Measured option, by injection only:** size that field to its control, so the label wraps:
`#deal-intake-head .deal-field { width: min-content; }`.

- **What changes:** "LUMP SUM COST" wraps onto two lines ("LUMP SUM" over "COST").
- **What it fixes:** the section then needs 853px of 876px, so it fits at 1240. Only the two
  pre-existing factoring squeezes remain on the tab, and 1920 has none.
- **Side effect:** it also clears the queued intake-head squeeze.
- **Not a regression:** the input reads 70px both before and after, as the earlier screenshots
  already showed.
- **Screenshot:** `prototypes/label-contrast/lc-intakeTrial-commercials-1240.png`.

**Ruling needed, one of:**

- **(a)** apply the measured option in this round (recommended). It fixes the squeeze this round
  created, by the estate's own recorded remedy, and clears one queued item as a side effect;
- **(b)** ship as is, with the 6px at 1240 only, and fix it with the queued intake-head item in
  the 1240 round;
- **(c)** something else for that label.

## 4. Still queued

The PO factoring card (219px, needs 243) and its toggle (185px, needs 209) at 1240, for the
opportunity-header 1240 round. Two of the four queued squeezes are cleared: the units head by this
round's fix, and the intake head if (a) is taken.
