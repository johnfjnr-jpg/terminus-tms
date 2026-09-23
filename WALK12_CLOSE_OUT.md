# Walk 12, cosmetics: close-out

Branch `walk12`, off `main` at `7c27efb`. **Build discipline 19: no
Superpowers skill was active in this session**; no worktrees, no
finish-branch or PR workflow, rule 18 absolute. Both preconditions confirmed:
`origin/main` equal, and the C2 edit controls present on `main`.

---

## RECONCILED BY COUNTING

| | Commit |
|---|---|
| G9, label contrast at the mechanism | `74ab596` |
| G1-G6, the Structural Terms cards | `b8c6864` |
| G7 and G8 | `896ef3f` |
| Close-out and `CURRENT_STATE.md` | this commit |

**Rulings in force: 1**, the walk 12 instruction with its nine findings.

---

## THE NINE

| | Finding | Evidence |
|---|---|---|
| **G1** | fields sized to their data | every control was 328px for a two-digit percentage; now 76px, currency select 104px |
| **G2** | card renamed "Duration and Margin" | live at both widths; **no test asserted the old title**, so nothing to re-point |
| **G3** | Contract duration first | live |
| **G4** | one line, label then value | 9 of 9 rows, both widths |
| **G5** | Currency the same | included in the 9 |
| **G6** | Tax Adjustments exactly two lines | 2 rows, WHT with its toggle then GST |
| **G7** | payment panels reduce to content | dead space 1,504px -> 37px at 3440 |
| **G8** | cash flow scroll bar visible | thumb 3.5:1 on its track, rule live in the CSSOM |
| **G9** | label contrast at the mechanism | every role clears 4.5:1; the two named labels compute #f2f2f0 |

**12/12** on the terms cards, **9/9** on the payment panels, **10/10** on the
scroll bar, **8/8** on the label census. All at the widths each finding names.

---

## G9: THE MECHANISM, NAMED

`Contract duration` rendered **#f2f2f0 at 15.29:1** and `SafeSight, existing
infra` rendered **#5f6065 at 2.73:1** - and both are `label.deal-field`, from
the same census entry list. The only difference was the **ancestor**:
`.unit-card label` set a colour and `.terms-field-row` set none, so the label
inherited white there.

**The colour of a label was a property of which card it landed in.**

### Before and after, per token

| token | renders | before | after |
|---|---|---|---|
| `--muted-2` on `--dark` | #5f6065 | **2.73** | retired from text |
| `--muted-2` on `--black` | #5c5c60 | **2.72** | retired from text |
| `--muted` on `--dark` | #86878a | 4.75 | 4.75 |
| `--muted` on `--black` | #848486 | 4.83 | 4.83 |
| `--white` | #f2f2f0 | 15.29 / 16.10 | unchanged |
| `--green` | #66cc99 | 8.70 | unchanged |

Five roles sat under 4.5:1 before, all on `--muted-2`: the intake table
headers, pricing item notes, section labels and the statement's sub-lines. All
64 text bindings became `--muted`; the field label role took `--white`.

**AND THE FINDING UNDERNEATH: there is no alpha at which a THIRD dimness level
clears 4.5 while staying meaningfully dimmer than `--muted`'s 0.5.** The
tertiary text level cannot exist at this contrast requirement. It collapsed
rather than being re-tuned, and `--muted-2` survives on one border.

The hierarchy survives in **typography** rather than dimness: the unit card
label stays 9px mono uppercase. Dimming was doing that job with contrast,
which is the one property a reader with poor eyesight cannot recover.

---

## WHAT THE ROUND CAUGHT IN ITS OWN WORK

1. **My first G4 measure passed while every row was stacked.** It compared the
   row's height with its tallest CHILD, and the child is the wrapper holding
   label above input - so a two-line field inside a one-child row reads as one
   line. The claim is a RELATIONSHIP between the label and the control, which
   is what the probe asserts now.
2. **My first G8 check could not discriminate.** It asserted the bar occupies
   layout. Calibrated against a control page with one styled and one unstyled
   container, **headless Chrome reported 2px for both**. Headless renders
   overlay scrollbars whatever the rule says. Replaced with what can be
   measured, and the probe now PRINTS what it does not establish.
3. **A source guard passed while asserting nothing.** The first
   `.unit-card label` test matched the FIRST rule of that selector, which sets
   only a margin. There are two. It enumerates all of them now.
4. **Specificity, twice.** The G1 sizing lost to `.deal-section input`, six
   thousand lines later, and the control took the grid track's 145px; scoped
   through `.pg-card` it lands at 76px. The same fault is already recorded in
   this stylesheet from an earlier round, four lines from where I hit it.

---

## REPORTED, NOT BUILT

1. **`.new-lead-scroll` carries four colour literals** - `rgba(242,242,240,…)`
   - predating the palette-tokens rule. A different surface, so reported
   rather than swept into this round.
2. **G8's layout half is not established by machine.** Headless cannot see a
   classic scrollbar. The rule is live, the contrast is measured, and whether
   the bar is visible on the real screen wants your eye.

---

## Exit gate

| Point | Answered |
|---|---|
| Build discipline 19 stated first | **Yes**, no Superpowers skill active |
| Preconditions, both | **Yes**, remote equal and C2 controls present |
| All nine findings built | **Yes** |
| Red-first where mechanisms move | **Yes.** G1-G6 4 of 6 red first; G7 red at 3440; G9 five roles under 4.5 |
| Live proof at 1440 and 1240 | **Yes**, and 3440 where the finding named it |
| Screenshots opened and read | **Yes**, and they confirmed the terms cards and the label raise |
| Palette tokens only, no literals | **Yes** for this round's work; the pre-existing four reported |
| `CURRENT_STATE.md` regenerated | see below |
| Merged or pushed | **No push from the session** |
