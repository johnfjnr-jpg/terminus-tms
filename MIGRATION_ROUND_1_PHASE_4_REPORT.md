# Migration Round 1, Phase 4: the field-row component

**Built 2026-09-05** from `MIGRATION_FIELD_ROW_CONTRACT.md` and nothing else.
**The five vanilla implementations were not opened**, for either the component
or its tests. Every place the contract was silent is a numbered finding below
with the position taken and the reasoning.

Gate green at 18 stages, React suite **86/86**. Ships unconsumed by ruling: no
production surface uses it this round. Nothing pushed. Phase 5 not started.

---

## 1. The interface

Five modules under `frontend-react/src/field-row/`, plus one addition to the
seam.

### `FieldDescriptor` - what a field declares about itself

```ts
interface FieldDescriptor {
  name: string
  label: string
  value: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none'
  readOnly?: boolean
  placeholder?: string
}
```

### `useFieldRows(fields) -> FieldRowsController` - the surface

Holds the drafts and owns **the one door**. `requestOpen(name, seedChar?)` is
the single edit-entry hook; `dirtyNames`, `dirtyCount` and `changes` are
computed across every field on the surface.

### `<FieldRow field rows />` and `<EditBar rows onSave />`

The row renders both halves and swaps them by `hidden`. The bar is a separate
component taking the same controller, so "the row cannot own the bar" is true
**structurally** rather than by convention.

### `ShellServices.canEditFields(): boolean` - the injected door

New on the seam. The guard is a function the shell provides, not a
`getElementById` inside a component, so the React tree does not couple to the
vanilla DOM's ownership class. Called at **every** entry attempt.

---

## 2. Each behaviour, and the test that would fail without it

The full suite is `frontend-react/src/__tests__/field-row.test.tsx`, **49
tests**. Named below is the test that fails if the behaviour is absent rather
than merely present-looking.

| # | behaviour | the test that fails without it |
|---|---|---|
| 1 | draft compared, not flagged | **"typing a value and typing it back reads CLEAN"** - an event-flag implementation passes every other test in that block and fails this one. Plus a longer detour, six values ending back at the original. |
| 2 | one door, ownership guard | **"and NEITHER does Enter"**, "nor Space", "nor a seed character, and no draft is left behind". A door on the click handler alone passes "a click does not open it" and fails all three. Plus **"the guard is consulted at EVERY attempt, not once at render"**, which a captured value fails, and "it covers a field added AFTER the surface mounted". |
| 3 | swap by visibility | "the edit half is already in the document while the row is closed", "the display half is still in the document once the row is open", and **"open and close leaves the same two nodes"**, asserted by node identity so a recreate fails it. |
| 4 | keyboard parity + seed | **"a printable character opens the editor AND the keystroke LANDS in the input"** - an implementation that opens on keydown and ignores the key passes everything else and fails this. Plus modifier combinations and navigation keys are not seeds. |
| 5 | discard restores | **"and it is NOT a close: the row is still open afterwards"** - the contract's own sentence, and a discard that closed passes both the restore and the clear-dirty tests. |
| 6 | bar aggregates across rows | **"a row rendered on its own produces no bar at all"** and "there is exactly ONE bar for a surface of four rows". Plus "it counts fields whose rows have been CLOSED again". |
| 7 | read-only is a different row | **"it has NO tab stop"** and **"it contains no input at all, disabled or otherwise"** - both fail on a disabled-editable-row implementation, which is exactly what the contract warns against. Plus "tab order is correct by construction", asserting the full ordered list of tab stops. |
| 8 | descriptors and `inputmode` keying | **"a field invented in this test inherits the guard by declaring inputMode"** - a guard keyed on field NAMES cannot pass it. Plus `acceptsValue` asserted directly as a pure function of the declaration. |

Two more blocks cover the seam's fail-closed behaviour.

---

## 3. Contract ambiguities, and the position taken

The contract was written from measured behaviour so this derivation could be
independent. **It is silent or underdetermined in eleven places the component
needed an answer for.** Each is resolved from the contract's own reasoning
rather than by opening the vanilla source.

### FINDING 1. `draft !== orig` is strict, and the contract does not say what type `orig` is

Behaviour 1 specifies strict inequality. A numeric field whose `orig` is a
NUMBER would be permanently dirty, because an `<input>` yields a string, and
behaviour 1 exists precisely so that typing a value and typing it back reads
clean.

**Position: `value` is always a string.** Numeric fields declare `inputMode` and
still carry their value as text. The type makes it unrepresentable.

### FINDING 2. Where the draft store lives is implied, never stated

Behaviour 1 says "each implementation holds `{draft, orig}` keyed by field
name". Behaviour 6 says the bar aggregates across all drafts on the surface and
that the row cannot own the bar.

**Position: the drafts live at the SURFACE**, in `useFieldRows`. Forced rather
than chosen: a row that owned its draft could not be counted by anything above
it.

### FINDING 3. `orig` is not stored at all, and the contract never contemplates a reload

Nothing in the contract says what happens if the record reloads under an open
editor.

**Position: `orig` is read from the descriptor on every comparison and never
copied into state.** Two consequences, both good, and the second is why this is
a finding rather than an implementation detail:

- there is no second copy of the original to drift from the record
  (Verification 20);
- if a reload brings the record to the value the person had typed, the field
  goes **clean**. Under a stored `orig` it would stay dirty against a value
  nobody holds any more.

**Behaviour 1 taken seriously produces the better answer on its own**, which is
some evidence the contract's insistence on computing rather than flagging is
load-bearing beyond the case it names.

### FINDING 4. The seed character: replace or append?

"Typing a character into a closed row opens the editor AND keeps the keystroke."
Silent on what happens to the value already there.

**Position: the seed REPLACES.** A closed row receiving a keystroke is a person
starting to type a value; appending gives `Acme LtdX`, which nobody wants and
nobody asked for. Nothing is lost, because behaviour 5's discard restores the
original and the row is dirty and visible in the bar meanwhile.

### FINDING 5. Which keys are seeds

Not stated.

**Position:** a single printable character with no Ctrl, Meta or Alt. Enter and
Space open **without** a seed, because they mean "open this" rather than "type
this". Navigation and editing keys (Tab, arrows, Escape, Backspace, Shift) are
not seeds. All asserted.

### FINDING 6. A seed the field cannot accept

Behaviour 4 and the `inputmode` keying interact and the contract never puts them
together.

**Position: a rejected seed does not open the row.** Opening on a character the
field will then refuse would show an editor that silently discarded the
keystroke that summoned it, which is behaviour 4's own complaint arriving one
step later.

### FINDING 7. Does closing a row clear its draft?

Not stated.

**Position: no.** If closing cleared the draft, close and discard would be the
same operation, and behaviour 5 exists to say they are not. Asserted directly:
two rows edited, both closed, the bar still reads "2 changes".

### FINDING 8. Does discard leave the row open?

The contract says "Discard is not 'close'", which states what discard is not,
not what happens to openness.

**Position: the row stays OPEN.** Restoring the original into the input is
pointless if the input is then hidden, and the contract's phrasing only makes
sense as a distinction between two things a person can do.

### FINDING 9. The guard's signature, and what it does on refusal

The vanilla door reads a class and `return`s. It is surface-level: a record is
not mine, not a field.

**Position: `canEditFields(): boolean`, no argument, and refusal is silent.**
Adding a field-name parameter nothing uses would be a defaulted parameter
hiding an incomplete change (Verification 24), and Round 2's Phase 0 is where
the guard's own reading is decided. Silent refusal matches the contract; a
visible message would be inventing behaviour the contract does not describe.

### FINDING 10. What if the shell provides no guard at all?

Cannot arise in the vanilla, where the DOM read always returns something. It
can arise here, because the guard is injected.

**Position: FAIL CLOSED.** A surface whose shell forgot the guard does not open
its fields, which is visible in the first second of use. Failing open would make
an absent ownership door look exactly like a present one, on the surface whose
whole purpose is stopping somebody editing a record that is not theirs.

### FINDING 11. Class names and the DOM contract

The contract names `.ref-field-display.readonly`, a vanilla class.

**Position: no vanilla class names are copied.** The component ships unconsumed
and its first consumer decides styling. Visibility uses the `hidden` ATTRIBUTE
rather than a class, which is doing real work: a hidden subtree is out of the
tab order by specification, so a closed row's input cannot be reached by
keyboard - the second half of the very defect behaviour 2 exists for.

**Also out of scope and confirmed as such:** field-specific editors, save
semantics and the revision handshake, all excluded by the contract's own
closing section. The bar takes an `onSave(changes)` callback and decides nothing
about payloads. Multiline fields are not mentioned by the contract and no
behaviour needs them.

---

## 4. Calibration evidence

**Nine injections, one per behaviour plus the seam. Every one fired. The tree
reverted to 49/49 afterwards.**

| injection | result |
|---|---|
| B1 dirty becomes a flag | 2 failed |
| B2 the door on the click handler only | 5 failed |
| B3 remove instead of hide | 15 failed |
| B4 the seed character dropped | 3 failed |
| B5 discard also closes | 1 failed |
| B6 the bar counts one field | 2 failed |
| B7 read-only as a disabled editable row | 4 failed |
| B8 the guard ignores the `inputMode` keying | 5 failed |
| the seam fails OPEN | 1 failed |
| **reverted** | **49 passed (49)** |

The two single-failure results are the point rather than a weakness: B5 and the
seam each have exactly one test that can tell the difference, and those are the
two tests that would not exist without the contract naming the behaviour.

---

## 5. What surprised

### a. The calibration harness broke, silently, and cost the phase's source

**The instance.** The harness snapshotted files with `snapshot $FILES` in a
shell script. **zsh does not word-split an unquoted variable**, so `$FILES`
arrived as ONE argument, every `cp` failed with "No such file or directory", and
the harness carried on. No snapshot existed. Restores failed the same way and
were also ignored.

Nine injections then landed **cumulatively** on three files with no backup. The
third broke the JSX, so every run after it reported `no tests` - which reads
like a harness problem rather than like source destruction.

**Recovered in full**, by reading the actual files rather than trusting a grep
(the first grep, with an unescaped pattern, said only one file was damaged; all
three were). `FieldRow.tsx` was rewritten whole; the other two were reverted
surgically.

**THIS IS THE SECOND ROUND RUNNING THAT A CALIBRATION HARNESS DESTROYED THE
WORK IT WAS CALIBRATING**, and the two failures share nothing mechanically.
Phase 3's used `git checkout`, which reverts to the last COMMIT rather than to
the pre-injection bytes. This one used `cp` in a shell that does not split
words. Verification 44's remedy - key on the full path - was followed here and
was not the problem.

**What the two have in common is that neither VERIFIED its own snapshot or its
own restore.** A harness that injects faults is the one piece of tooling
guaranteed to be pointed at uncommitted work, and it is the piece nobody tests.

The replacement is a Node script that (1) keys on the full path, (2) **asserts
the snapshot file exists before injecting anything**, and (3) **compares the
restored bytes to the original after every injection and stops dead** rather
than compounding. It also refuses an anchor that is not unique.

**Both times it was the final "reverted" line that caught it.** That line costs
one run and it has now paid for itself twice.

### b. Behaviour 3's mechanism turned out to enforce behaviour 2's defect

`hidden` was chosen for behaviour 3 - swap by visibility, never removal - on the
contract's stated reasoning that a control which vanishes reads as "what did I
just break".

It also happens to be the fix for the other half of behaviour 2's recorded
defect: a hidden subtree is out of the tab order by specification, so the closed
row's input cannot be reached by keyboard. The contract's door stops the editor
OPENING; `hidden` means that even if it did, there is nothing tabbable inside a
closed row.

**Two behaviours written as separate clauses, and one mechanism satisfies both.**
Recorded because it is weak evidence the contract is describing one design
rather than seven habits.

### c. 49 tests passed on the first run, which is when a suite deserves least trust

No iteration, no red-green. That is the signature of a suite written to agree
with the component, which is precisely what the contract's closing warning is
about, and the reason the calibration was not optional. It fired nine times out
of nine.

### d. Reading the contract without the source made two clauses read differently

Behaviour 5's "discard is not close" and behaviour 6's "the bar is a property of
the surface, not of a row" are both stated as **negatives**. With the vanilla
open, a negative reads as a note about how the existing code happens to work.
With only the contract, a negative is the whole specification, and both forced a
structural decision: discard leaves the row open (FINDING 8), and the bar is a
separate component taking the controller (FINDING 2).

**The prohibition on reading the source made the contract sharper to work from,
not vaguer.** Worth recording before Round 2 decides whether to keep the rule.

### e. The gate's 130ms failures, again

The first Phase 4 gate reported 14 of 18 stages FAILED, every HTTP stage in
about 130ms against normal durations of 12,000 to 57,000ms. Verification 48:
the session token had expired. Third time in two days, and the timing said so
before any failure was opened.

---

## 6. Gate

```
MERGE GATE  18 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                 86/86 pass, 0 fail    (37 + 49 new)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 18 stages passed.
```

`dist` rebuilt in the same commit: the seam changed, and the seam is in the
bundle. The field-row component itself is tree-shaken out, because nothing
imports it yet.

---

## Standing at the close

Not pushed. Phase 5 not started. No production surface consumes the component,
by ruling: its first consumer is Round 2's first row-bearing surface, and
surviving that contact is the real proof. **This report's eleven findings are
the list that contact should be checked against.**
