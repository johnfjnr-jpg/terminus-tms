# Migration Round 5, Phase 2: the swap

Session of 2026-09-06. The swap landed, the write path and the door were
walked live, and the visual comparison found three defects no assertion could.

---

## WHAT IS NOT FINISHED, FIRST

**There is one open defect, it is live on the swapped surface, and it should
block sign-off.**

### OPEN: typing into a textarea row reverses the text

**A person typing `abcd` into the Executive Summary gets `dcba`.**

Measured, in the same run, on the same record:

| row | control | selectionStart after each keystroke |
|---|---|---|
| `country` | `<input>` | 1, 2, 3, 4 — correct |
| `summary` | `<textarea>` | **0, 0, 0, 0** — `a`, `ba`, `cba`, `dcba` |

**What is established.** Assigning `.value` to a `TEXTAREA` resets its
selection to 0, where the same assignment on an `<input>` is a no-op, and
React's controlled update assigns on every commit. The reproduction is
`scripts/round5/walk-reference.mjs`, and the tightest form is four keystrokes
with `selectionStart` read after each.

**What is NOT established: the mechanism.** Two fixes were tried and neither
worked.

- **Memoising the descriptor identity**, so the rows are not rebuilt
  mid-keystroke. **Kept**, because stable identity is right on its own terms —
  but it did not fix this, which falsified my first theory that the second row
  typed into was the trigger.
- **A layout effect restoring the caret** from `onChange`'s `selectionStart`.
  **Removed.** A fix that looks applied and does nothing is worse than the
  defect, because the next reader stops looking. The site now carries a
  comment saying the defect is open and what was tried.

**Why I stopped rather than continued.** The Round 4 precedent: the observable
is established and reproducible, the mechanism is not, and a speculative fix
to a shared editor at the end of a long session is the wrong way to close a
swap. The difference from Round 4 is that **this surface is live**, so the
recommendation is stronger: Phase 3 opens on this, and the swap should not be
signed off until it is fixed.

**Scope: one editor kind.** Text, select, date and checkbox rows are
unaffected and were walked. `summary` is the only textarea on this surface.

---

## 1. The swap

One commit. The bundle registers `initOpportunityReferencePanel`; the vanilla
tag is commented in place with its restore instructions; the Reference markup
is wrapped in `#ref-vanilla` and hidden by the mount; `#ref-root` is the
container. The stats strip stays outside both, because `app.js` writes it
directly and it is not part of the surface being migrated.

**The door opens in the same commit.** `CAN_EDIT_BY_VIEW` gains its
`opportunity-detail` line here and not before: the seam fails closed, so
earlier would open a door on a surface nobody can see and later would ship a
live surface nobody can edit. It reads the class `app.js` maintains rather
than deriving ownership twice, and the `!!v` is a recorded divergence — the
vanilla door yields `undefined` on a missing element and so fails OPEN.

**The panel fetches its own staff.** `terminusStaffCache` is a module-scope
`let` a bundle cannot read, so Round 2's ruling applies again. One new global,
no accessor.

**The coupling ledger runs both ways**, and its strings clause found something
about the instrument rather than the code: `frontend/test-bed-detail.js`
survives comment stripping because its mention sits in an **HTML comment
inside a JS template literal**, which `readCode` is right not to strip.
Ledgered with that disposition rather than filtered away.

## 2 and 3. The walk, and the door on real ownership

`scripts/round5/walk-reference.mjs`, **40/40**.

Every editor kind opened and typed into live; the batched save round-tripped
with only-dirty keys and `duration` as a number; the suffix rendered after the
save; **`estGoLive` carries its `min` on the live server, which the vanilla
does not** (Phase 0 finding 1, inverted); same-as-account flipped both ways
with a boolean flag stored and no address copied; key contacts rendered.

**The door, on a record genuinely owned by somebody else**, created by admin
write: all 21 rows refuse by click, by Enter, by Space and by seed; the
same-as-account direct input is disabled; the read-only rows carry no tab
stop; and after handing the record back, all 21 open again.

**The walk found a defect no unit test could.** An empty row with no declared
placeholder rendered an empty span, so its display half **collapsed to height
0 and could not be clicked at all** — width 1236, height 0, visible, not
hidden. jsdom has no layout, so 550 tests passed on a row a person cannot
reach. Pre-existing in the shared component; the Account surface gains the fix
too.

**Five probe faults, corrected rather than worked around.** Two are worth
keeping: `isOpen` read `!el?.hasAttribute('hidden')`, which yields
`!undefined` = TRUE for a read-only row with no edit half, so six correctly
refused rows counted as open (Verification 14). And the 409 check asserted a
refusal that correctly never comes — `oppPatch` owns the precondition *and*
the retry, so the surface inherits absorption; the walk now asserts both
writes survive.

## 4. The visual comparison

`scripts/round5/visual-reference.mjs`, **22/22** at 1240, 1920 and 3440, React
and vanilla on the same record.

**The vanilla is reached by loading its module in the browser and calling
`loadOpportunityDetail`, which IS the load-order revert at runtime** — and
that correction mattered: rendering the vanilla panel directly skipped
`app.js`'s ownership sweep and measured **0** read-only tab stops against
Phase 0's live **5**. The sweep is what puts them there.

### The two deliberate divergences, measured rather than asserted

| | vanilla | React | why |
|---|---|---|---|
| read-only rows | **5 tab stops** | **none** | behaviour 7. The vanilla's are a side effect of `EDIT_OPENING_SELECTOR` matching `.ref-field-display` with no `:not(.readonly)` |
| the edit bar | **no count** | **a count** | behaviour 6. The vanilla computes `dirtyCount` and uses it only as a boolean |

Both hold at all three widths.

### Three divergences that were NOT deliberate

Verification 4 is the whole of this item: every programmatic check passed on
all three.

1. **The migrated field row had no styling at all.** `.field-row` and its
   children have no rules in `style.css` and never have, so the surface
   rendered as labels and values stacked in plain text. **That was true of the
   Account surface too, live since Round 2.** The React class names are kept
   (finding 11) and the vanilla's measurements copied.
2. **`display: flex` overrode `[hidden]`.** Every closed row's editor rendered
   visible — inputs, selects and Discard buttons down the page — while every
   test passed, because the tests read the attribute and the attribute was
   set. It breaks behaviour 3 and behaviour 2's second half at once, since a
   hidden subtree is what keeps a closed row's input out of the tab order.
3. **No cards and no section names.** The vanilla renders four titled cards in
   a responsive grid; the React surface rendered one flat column. Round 40's
   finding again. Date Created also showed a raw timestamp.

## 5. Identity adoption

The load-bearing name that was missing is **`.is-not-mine .ref-field-display`**
— `app.js`'s read-only *treatment*, keyed on the vanilla's class. The React
rows do not carry it by design, so on a record somebody does not own **they
looked fully editable while the door correctly refused every one**. A row that
reads as live and does nothing is worse than either half alone.

## 6. The injection sweep

`scripts/round5/inject-phase2.mjs`. **12/12 detected**, reverted run green,
all seven files byte-identical.

**The first run caught 8 of 12, and the four silences were the point.** Each
named something true, relied on and asserted nowhere; none was explained away.
The `[hidden]` override, the ownership treatment, the card titles and the
only-dirty save all now have detectors — the last needed a new
`reference-host` suite, because the surface tests assert what the panel *hands*
to `onSave` and nothing asserted what the host *sends*.

**And the twelfth injection was a no-op before it was a test.** It added
`country` to every save — the key the assertion already edits — so the test saw
exactly what it expected. Same shape as Phase 1's suffix injection: **a silent
verdict is a claim about the injection until the injection is shown to violate
something.**

---

## The ledger

| direction | instrument |
|---|---|
| what reads the vanilla | `reference-coupling.test.mjs`, 8 entries, each disposed |
| what the React surface reaches for | exactly two shell globals, `oppPatch` and `loadOpportunityDetail`, asserted |
| the vanilla's lexical state | asserted absent by name, all eight |
| strings | a disposition ledger, because a pattern cannot tell a path from a claim |

## Surprises

**The Account surface has been unstyled since Round 2** and nobody saw it,
including its own round's visual check. It took a side-by-side capture against
a vanilla equivalent to make it visible.

**Two of my own fixes to the open defect failed**, and the second was worse
than useless — it read as a fix. Removing it was the more important half.

---

## Gate

**All 21 stages passed** on `5151543`, the tree this
report is committed on, clean.
Pure 472/472, database 92/92, react 561/561, all 0 fail, and
14 HTTP probes. Every figure parsed from the run rather than typed.

**A green gate is not a green surface here.** The open defect above is live
and no automated stage can see it: jsdom has no caret, and the walk that
found it is not a gate stage. That is stated rather than left for a reader
to infer from a passing run.

Transcript: `.verify/verify-1154131491545375.txt`

**Not pushed. Phase 3 follows on sign-off — and the open defect above should
be the first thing it takes.**
