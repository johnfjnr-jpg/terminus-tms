# The Create click bug: Phase 0 and Phase 1

**A regression on a shipped screen, taken on the full path.** Reproduced,
caused, fixed, proven by the user path, and guarded so it cannot recur
silently. **Nothing pushed.**

---

## PHASE 0

### Reproduced

```
DETAIL screen
  before click : {trigger:true, menu:false}   atPoint=BUTTON.contact-create-trigger
  after  click : {menuInDom:true, menuHidden:true,
                  menuClasses:"contact-create-dropdown hidden", ariaExpanded:"false"}
  => NOTHING OPENED
LIST screen
  open dropdowns after click: 1  => WORKS
```

**The reading names the cause.** The menu **is** in the DOM - React rendered
it, so the click handler fired - and it carries `hidden` and
`aria-expanded="false"`, **neither of which React writes.** `.cd-create-menu`
is conditionally rendered; there is no `hidden` class in the component and no
manual `aria` write.

### THE HYPOTHESIS IN THE BRIEF DOES NOT HOLD, and the evidence is one line

> *"the probe almost certainly called createFromContact / drove the dialogue
> directly, NOT clicked the trigger"*

**`scripts/contact-mode/probe-p1-modes.mjs:91`:**

```js
await page.click('[data-testid="cd-create"]')
await page.waitForFunction(() => !!document.querySelector('[data-testid="cd-create-menu"]'), ...)
await page.click('[data-testid="cd-create-test-bed"]')
```

**It clicked the real control, waited for the menu, then clicked the menu
item.** No `createFromContact` call anywhere on that path. **It tested
click-to-open and it passed** - the defect arrived afterwards.

**BUT THE BRIEF IS RIGHT ABOUT THE GAP, one level down.** The probe asserted
the menu was **IN THE DOM**. Throughout this bug the menu **was** in the DOM -
it was hidden. **Presence, not visibility**, which is Verification 4's own
sentence arriving in a probe that clicked correctly.

### The cause

**Group A's A5 regressed the contact-mode round's R4. Both are mine.**

```js
window.closeContactCreateMenus = () => {
  document.querySelectorAll('.contact-create-dropdown').forEach((d) => {   // DOCUMENT-WIDE
    d.classList.add('hidden')
    ...t.setAttribute('aria-expanded', 'false')
```

A5 gave the Contacts LIST a click-to-open menu with an outside-click closer.
That closer sweeps **every** `.contact-create-dropdown` in the document. **The
detail screen's menu is React's and wears that class**, because it wears the
estate's declared treatment for the control - which is correct and is what
Verification 7 asks for.

The listener tests the click against `.contact-create-hover`, the LIST's
anchor. The detail's anchor is `.cd-create-anchor`, so a click on the detail
trigger reads as "outside", and vanilla closes a menu React had just opened,
**in the same tick**. React does not re-render, because its own state still
says open.

**Proven causally, not inferred**: with `closeContactCreateMenus` neutralised
in the page and the surface reset by a reload, the same click gives
`{inDom:true, hidden:false, visible:true}` - **the menu opens.**

---

## PHASE 1

**The fix is one selector**: vanilla sweeps only its own anchor's menus.

```js
document.querySelectorAll('.contact-create-hover .contact-create-dropdown')
```

**Vanilla does not reach into React's DOM.** The detail menu owns its own
outside-click and Escape handling and always did.

### Proven by CLICKING, at 1440 - 10 of 10

```
CLICKING Create renders the menu                                      PASS
and the menu is VISIBLE                                               PASS
clicking Test Bed opens the shared dialogue                           PASS
a Test Bed was created from the DETAIL screen by clicking             PASS
and it carries the contact ("CFIX Contact")                           PASS
it opens again on a fresh load                                        PASS
and Escape closes it                                                  PASS
THE LIST IS NOT REGRESSED: 1 menu open on click                       PASS
and the list still closes on an outside click                         PASS
```

**Nothing in that probe calls `createFromContact`.** Every step is a click on
the control a person clicks, and **the menu assertion is VISIBILITY** - which
is the assertion the old probe lacked and the one this bug would have failed.

### AND A GUARD, so a mechanism test can never again pass while the control is dead

`seam-ledger.test.mjs` now refuses any `querySelectorAll` in `app.js` that
names a class React also renders, unless it is scoped to vanilla's own anchor.
**The class list is DERIVED from `StageActions.tsx`** rather than retyped, so
it cannot rot when the class changes, and it asserts its own non-vacuity.

**Calibrated on the real defect**: the unscoped selector reinstated, the guard
fires and names it -

```
app.js sweeps a class React also renders, document-wide, so it reaches into
React-owned DOM and silently undoes what React just did:
querySelectorAll('.contact-create-dropdown')
```

- restored byte-identical, reverted run green.

---

## What this does NOT establish

- **1440 only**, and one contact.
- **The guard covers `app.js` sweeping REACT's classes.** The reverse - React
  reaching into vanilla's DOM - is not covered by it.
- **A second finding, not chased**: component state **survives navigation**.
  Navigating away from the detail screen and back left the menu's `menuOpen`
  true, because this shell re-renders its root rather than remounting. It cost
  a measurement cycle here and is **carried, not fixed**.
