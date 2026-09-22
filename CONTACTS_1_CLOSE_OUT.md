# Contacts round (walk 9): close-out

Branch `contacts-1`, off `main` at `92677e9`, confirmed equal to `origin/main`
by `git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 governs: this round ends **"ready for John's push"** and nothing is
pushed from the session.

---

## STEP 0: the three carried rulings

| | Ruling | State |
|---|---|---|
| **L7** | retired by design: main notes carry no stage chip, the shared helper stays shared | **CLOSED**, recorded in the audit |
| **L12** | the hardcoded R&D tag is not restored | **CLOSED**, and recorded that record-level tags are a feature to scope, not a restoration |
| **C9** | the card title becomes "Unit Counts" | **BUILT**, `tb-card-sensors` unchanged |

C9's evidence that nothing keyed on the title: 1290 react tests passed
untouched. The comment that named the old title was corrected in the same
change, which is Architecture 9's fourth variant caught at its source.

---

## STEP 1: K2 and K4 built, K1 STOPPED

### K2, every field sized to the data it displays

| | before | after | its data |
|---|---|---|---|
| Contact | 163px | **122px** | 114px |
| Role | 156px | **116px** | 109px |
| Linked | 170px | **127px** | 120px |
| Stance select | 324px | **104px** | 67px |
| Add picker | 390px | **220px** | |
| the table | full card | **648px** in an 876px card | ~657px |

**And the add row's sizing rules were DEAD.** `.kc-add-row` and three
`#kc-add-*` rules set exactly the intent K2 asks for, keyed on names the
surface stopped carrying at the migration: the card renders `.kc-add` and
identifies its controls by `data-testid`. The intent moved onto the class that
is rendered.

### K4, Stance on one row

The select and the note were inline controls in a plain `<td>` and stacked -
measured, the select at y 1915 and the note at y 1950 on every row. The cell is
a flex row now, and no child is given a `display`, so the Record button's
`hidden` attribute still hides it.

### K1: STOPPED. The column cannot hold the card.

| | |
|---|---|
| Customer Details column, inner width | **392px** |
| the card's floor, as it now stands | **680px** |
| the card's IRREDUCIBLE minimum | **711px** |
| short by | **319px** |

**MEASURED AFTER K2 AND K4, deliberately.** Stopping on the baseline would
have been stopping on a floor this round was about to change.

**AND K4 MAKES THE CARD WIDER, NOT NARROWER**, which is the finding inside the
finding. Putting the stance controls on one row costs **319px in that cell
alone** - 81% of the entire column - where stacking them cost 282px of width
and two lines of height. So the two rulings pull against each other: K4 as
ruled and K1 as ruled cannot both hold.

The report carries the options.

---

## STEP 2: K3 built, after measuring the loss

**Measured before anything was built**, per Verification 52:

| | before | after one click |
|---|---|---|
| `record_contacts` | 2 | **1** |
| `record_contact_stances` | 2 | **0** |
| `key_contact_removed` audit | 0 | 1, carrying the full history |
| native `confirm()` | | **none** |
| in-page dialogue | | **none** |

So it IS an immediate loss, and the dialogue says what was measured and not a
word more: it cannot be undone **from this screen**. The audit row preserves
the contact, the role and the stance history, but nothing in the product reads
it and there is no restore path anywhere - measured across `src`, `frontend`,
`frontend-react` and `scripts`.

Built on the shared `Modal`, so focus-on-open, Tab confinement, Escape and
focus return are inherited rather than re-implemented.

**17/17 live**, both widths, cancel and confirm both read back from the
database.

---

## Exit gate

| Point | Answered |
|---|---|
| The three carried rulings closed and recorded | **Yes** |
| K3's loss MEASURED before the dialogue was built | **Yes**, and it is what the wording rests on |
| K1's fit measured against the card's real content | **Yes**, and after K2/K4 rather than before |
| K2 and K4 built | **Yes** |
| Red-first guards | **Yes**, calibrated 7/7 on named checks |
| Live proof at 1440 and 1240 | **Yes** |
| Screenshots opened and read | **Yes** |
| Database read-back where written | **Yes**, both K3 paths |
| Fixtures torn down, re-queried | see below |
| `CURRENT_STATE.md` regenerated | see below |
| Full gate, branch and merged | see below |
| Pushed | **No push from the session** |
