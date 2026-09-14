# Contact-mode furniture, Phase 0: measure

Read-only except two probe page-loads that opened a dialogue and closed it.
**No writes.** All four questions answered, and the first one - the one that
sizes the round - answers in the round's favour.

---

## Q1 - THE DIALOGUE IS INLINE VANILLA, AND IT IS ALREADY PUBLISHED

**So R4 POINTS AT IT. No extraction.** This is the small shape of the round.

The dialogue is `#new-test-bed-modal` in `frontend/index.html`, driven by
`frontend/app.js`. It is not a React component. **But its entry point is
deliberately on `window`:**

```js
window.createFromContact = async (id, type) => { ... }      // app.js:5807
window.onContactCreateClick = (id, type) => { ... }         // app.js:5780
```

**Not an accident of declaration form** - these are explicit `window.`
assignments, unlike `contactsCache` and `ntbType`, which are module-scope
`let` and unreachable from a bundle by construction (Migration Round 2's
declaration table).

**What `createFromContact` does, in order:**

1. Looks for an existing record of that type already linked to this contact
   by name (`customerLead` / `initialLead`).
2. If any exist, opens the **linked-records warning** with a proceed.
3. Otherwise, or on proceed, `openNewRecordModal(id, type)`: heading, label
   and save-text set by type, **a suggested name fetched from the server by
   the same function the create endpoint itself uses**, a full focus trap,
   Escape and Enter owners.

**It is a complete, well-built dialogue and it satisfies
`INTERACTION_STANDARDS` §4.** Reusing it is plainly right.

### AND THE LIST'S CONTROL IS ALREADY R4'S SHAPE

```html
<span class="contact-create-trigger">+ Create</span>
<div class="contact-create-dropdown hidden">
  <div class="contact-create-item" onclick="...onContactCreateClick(id,'test-bed')">
  <div class="contact-create-item" onclick="...onContactCreateClick(id,'opportunity')">
```

**One trigger, two items, then the shared dialogue.** R4 asks for exactly
that on the contact view, so the contact view mirrors the list's flow rather
than inventing one.

### THE TYPE IS TOLD, NOT CHOSEN - and that is the one decision Phase 1 needs

`openNewRecordModal(contactId, type)` is **given** its type; the dialogue
offers no choice. So a single Create control must resolve the type **before**
calling. Two ways:

- **(a) The Create control offers the two, then calls the shared dialogue
  unchanged.** Mirrors the list exactly. **Recommended**, because R4 says the
  SAME dialogue, and this changes it not at all.
- (b) Teach the shared dialogue to choose. That edits a mechanism the
  Contacts list depends on, for a need only the contact view has.

**Recommendation (a)**, recorded as an implementation decision under the
standing delegation rule and revisitable.

### THE CAVEAT I EXPECTED TO FIND, MEASURED AND DISMISSED

`createFromContact` reads the contact's name from **`contactsCache`, a
module-scope `let`** filled by `loadContactsData()`. The obvious risk is that
landing on contact-detail **directly** leaves it empty, so the duplicate
warning silently fails open.

**Measured behaviourally, because a `let` cannot be read from a probe** - the
observable is which modal opens, on a contact with 3 existing linked
opportunities:

```
visited the Contacts list first    after={"warning":true,"name":false}
landed on contact-detail directly  after={"warning":true,"name":false}
```

> **The warning fires on both paths.** The cache is populated either way, so
> reusing the mechanism from the contact view inherits nothing.

**And the reading discriminates**: had the name not been found, `existing`
would be empty and the **name dialogue** would have opened instead - a
different, visible outcome, not a silent one.

### THE CONSTRAINT PHASE 1 INHERITS

`frontend-react/src/shell-services.ts` opens with:

> **"THE ONLY MODULE THAT READS window.*"**

So the call goes **through the seam**, never from a component. That is the
estate's own convention and it is stated at the site.

---

## Q2 - THE MODE SIGNAL IS `status === 'Qualified'`, and it already exists

**`record_type` cannot distinguish them**: measured, leads and contacts are
both `record_type: 'contact'`; the earlier population queries select on
status precisely because of that.

**The estate already branches on exactly this, in two places:**

```js
returnViewFor(status) => status === 'Qualified' ? 'contacts' : 'leads'
StageActions:            const qualified = status === 'Qualified'
```

**So mode-awareness keys on the real signal and adds no new one.**
`ContactPanel` already receives `status` as a prop.

## Q3 - WHAT `StageActions` RENDERS, AND WHY MODE-SCOPING IS FREE

| control | today | contact should |
|---|---|---|
| **Qualify** | `!qualified` only | unchanged - never shows on a contact |
| **Nurture** (`cd-btn-park`) | **unconditional** | **R3: hidden** |
| **create section**, 2 buttons | `qualified` only | **R4: one Create control** |

> **Only Nurture is unconditional.** Guarding it with the same `qualified`
> the component already computes is mode-scoped **by construction**, not by
> care - the lead view's status is `Unqualified` or `Nurture`, so the guard
> cannot reach it.

**AND THE CONTACT VIEW'S CREATE BUTTONS DO NOT CREATE ANYTHING TODAY:**

```js
onCreate={(kind) => { shell.navigate(kind === 'test-bed' ? 'test-beds' : 'opportunities') }}
```

**They navigate to a list.** They do not carry the contact, do not open a
dialogue, and never reach `POST /contacts/:id/create-test-bed`. Grepped
across the repository: the **only** caller of those two routes outside probes
is `app.js`. **R4 therefore adds a capability rather than relocating one**,
which is worth saying plainly because "replace the buttons" sounds like a
move.

## Q4 - TITLE AND CHIP ARE BOTH IN `ContactPanel`, BOTH ON THE `status` PROP

```jsx
<div className="cd-title" data-testid="cd-title">Lead details</div>
{status ? <span className="tag" data-testid="cd-status">{status.toUpperCase()}</span> : null}
```

The title is a **hardcoded literal** - Architecture 9's fourth variant, true
when it was typed and false since the surface began serving contacts. Both
sit in the component that already knows the status, so R1 and R2 are
contact-path-only without any new wiring.

---

## AND LEAD-MODE IS REACHABLE, so "unchanged" is testable

```
frontend-react/src/leads/LeadsList.tsx:196   onOpen={(id) => shell.navigate('contact-detail', id)}
frontend/app.js:5568                          onclick="navigate('contact-detail', '<id>')"
```

**The lead card's own row-click opens this same surface.** So contact-detail
serves both modes today, the `!qualified` branches are live rather than dead,
and **Phase 1's "lead-mode unchanged" claim can be proven on a real lead
rather than asserted.**

---

## What Phase 1 will do

1. **R1** - the title reads "Contact details" when `qualified`, "Lead details"
   otherwise.
2. **R2** - the chip renders only when **not** `qualified`.
3. **R3** - Nurture guarded by `!qualified`.
4. **R4** - the create section becomes **one Create control** offering Test
   Bed or Opportunity, calling `createFromContact` **through the shell seam**.
5. **Tests on BOTH modes**, because every one of these is a conditional and a
   test on one branch proves nothing about the other (Verification 24: a
   defaulted branch hides an incomplete change until a second value exercises
   it).

## What this does NOT establish

- **Nothing about how the new Create control should LOOK.** The list's is a
  hover dropdown on a grid row; the contact header is a different context, and
  the conformance gate governs what it may be made of.
- **No claim that the lead view is otherwise correct** - only that it is
  reachable and that these four changes must not touch it.
- **The duplicate-warning measurement covers one contact** with 3 existing
  opportunities, on two navigation paths. It is not a survey of every entry
  route into the surface.
