# The Create click bug: close-out

**CLOSED** on the gate at `9c249f8`, **24 of 24, exit 0**. **PUSHED** -
`ls-remote` confirms `origin/main` = local HEAD =
`9c249f8d2fddfe97e59076bef14b7db22dc0cfc8`. **John's walk confirms Create now
works on the detail screen.**

**NO SERVER RESTART**: `src/` unchanged. The fix is one selector in
`frontend/app.js`, served from disk - a browser reload is all it needs.

## What it was

**A CROSS-SURFACE REGRESSION.** Group A's A5 gave the Contacts LIST a
click-to-open menu whose outside-click closer swept **every**
`.contact-create-dropdown` in the document. The contact DETAIL screen's menu is
React's and wears that class - correctly, because it wears the estate's
declared treatment. Vanilla closed a menu React had just opened, in the same
tick, with no re-render because React's state still said open.

**The screen that was changed worked. The screen that shared its classes
died.**

## The lesson is BLAST RADIUS, not path

**The light path did not cause this.** A5 was correctly identified as an
interaction change and the list *was* verified. What was missing is the
question **who else wears this class** - and that question is owed by any
change to shared code, on either path, because **blast radius is a property of
the code rather than of the round.**

**Promoted into `CLAUDE.md` under Verification 20**, as an extension and not a
number: *two owners of one CLASS, where one sweeps document-wide.*

## The probe gap

**The old probe DID click the control** - that part of the brief's hypothesis
did not hold, and the line is `probe-p1-modes.mjs:91`. **It asserted the menu
was IN THE DOM**, and throughout this bug the menu was in the DOM and
**hidden**. Presence, not visibility.

## Both fixed

1. **One selector** - vanilla sweeps only its own anchor, so the reach is
   impossible rather than unexercised.
2. **A `seam-ledger` guard** - refuses any unscoped `app.js` selector naming a
   class React also renders, with the class list **derived from the component**
   so it cannot rot. **Calibrated on the real defect**, restored byte-identical.

**Proven by CLICKING at 1440, 10 of 10**, nothing calling `createFromContact`,
and the menu assertion is **VISIBILITY**.

## Carried

1. **Component state survives navigation** - `menuOpen` stayed true on return,
   because the shell re-renders its root rather than remounting. **Stale-state
   family; will surface as a walk finding.**
2. **Item 5**: teardown-scoping's population dependency on accumulated history.
3. **`StageActions` outside the conformance gate.**
4. **The two unstyled buttons** (`Link to Account`, `Save task`).
5. **(d)** full `ContactHost` retirement - unscoped.
6. The **ENFORCEMENT GAPS** carrieds.

**This close-out and the `CLAUDE.md` promotion are markdown and rules with no
gate reader, and ride the green gate at `9c249f8` under build-discipline
48(a).**
