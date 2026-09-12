# Phase 0: measurement

Read-only. Nothing built, nothing pushed. The follow-up panel was not
polished or touched (R7) and Lead Detail was not opened.

**One item cannot be delivered as ruled without a decision from John: R3
is in direct tension with R7.** Section 3.

---

## 1. R1's defect, reproduced

Pressing Qualify on an incomplete lead, measured live:

| | |
|---|---|
| fields the popup lists | **9** |
| fields the server says are missing | **9** |
| the two lists match | **true** |
| **inputs for entry inside the popup** | **0** |
| buttons in the popup | `["Close"]` |
| address-group fields among the 9 | **5** |

The popup's own message reads *"This lead needs 9 more fields before it
can be qualified. **Open the lead to fill them in.**"*

**So the defect is exactly as ruled.** The list is right, and it comes
from the right place - the server's `computeBlocking` through
`exit-criteria`, which Phase 2 already proved by comparing the rendered
lines against the endpoint's own output. **What is missing is any way to
act on it.** Five of the nine are the address group, so finishing means
leaving the popup, and the popup itself says so.

**R1 is therefore an ADDITION, not a correction.** Nothing about where
the list comes from changes; the popup gains the fields as inputs and a
save, and the message becomes the plain sentence John asked for.

Screenshot: `.verify/leads-polish/p0-popup-today.png`.

---

## 2. Address today, and what R2 needs

The disclosure measured on the card: **6 cells, 0 controls, 123px tall**,
rendered **inline in the card**.

R2 wants a **popup** and **editable**, which makes it three things it is
not: a different surface, a write path, and a door subject.

### What is shareable, and what must be card-local

**Nothing of Lead Detail's address panel can be reused without touching
it.** The address fields on Lead Detail are rendered through its own
field-row machinery, which is part of the frozen surface. Sharing would
mean either importing from it - coupling a live surface to one being
retired - or extracting a component out of it, which is an edit.

**So the editable popup is card-local**, and the honest statement is that
this duplicates address editing while Lead Detail stands. That is the
same shape as `NurtureDialog`, declared last round: when Lead Detail
retires after John confirms parity, the card's becomes the only one.

**The write path already exists and needs nothing new**: `PATCH
/api/contacts/:id` with a payload, which the card's inline writes already
use.

### The door consequence, which is the part that flips

Last round's **R11 ruled Address ALIVE on an unowned card**, because it
was a read disclosure and the revealed panel held **zero** controls -
asserted, not argued. **R2 makes it a write**, so that reasoning expires
with it. The new shape: the popup opens and reads on an unowned lead, its
**inputs and Save are dead**, and the zero-controls assertion is replaced
by one that distinguishes reading from writing.

---

## 3. R3, AND THE TENSION WITH R7

### Card heights, measured at three widths

| | 1240 | 1920 | 3440 |
|---|---|---|---|
| lean card | **343px** | 295px | 295px |
| busy card (10 notes, long summary) | **526px** | 472px | 439px |
| lean cards fitting an 1100px viewport | **3** | 3 | 3 |

Composition of the lean card: `head 24 + actions 34 + body 234`, padding
`14px 16px`.

### What actually drives it, and this is the finding

`.lead-card-body` is a **three-column grid**, so its height is the
**tallest column's content**, not a sum. Grid items stretch, so the first
reading had all three at 234px - true, and useless. Measured by content
extent:

| column | content |
|---|---|
| Summary | **42px** |
| Notes | **171px** |
| **the third column** | **218px** |

**The third column is the follow-up panel, and R7 freezes it.**

- **Floor while it stands: 218px of body.**
- **Shrinking Summary and Notes buys at most 16px.**

### So R3 cannot be delivered as ruled this round

The card is 343px at 1240 and **252px of that is head, actions, padding
and a body floored by a component this round may not touch**.

**What IS achievable, and it is not nothing:**

- **R5's action-row move is the largest lever available.** The action row
  is 34px on its own row; moving it onto the top line removes that row
  and its margins, roughly **34 to 44px**, about 10-13% of the lean card.
- Summary and Notes together: **up to 16px**.
- **The busy card is a different story.** Its body is 285px against the
  lean 234, and the only difference is content - so on a busy card
  **Notes is the driver, and Notes is touchable.** Collapsing or
  capping the notes column helps exactly the cards that are worst.

**Three ways forward, and I recommend the third:**

1. Take the ~50px R5 and Notes allow, and report R3 as partially met.
2. Touch the follow-up panel anyway. **Against R7**, and R7's own
   reasoning is that polishing a panel about to be rebuilt is work thrown
   away.
3. **Take the achievable savings now, and let R3's remainder fall out of
   the follow-up-entity round**, which rebuilds that panel anyway and
   will set its own height. **Recommended:** it is the only option that
   neither breaks R7 nor reports a number John did not get.

**This is John's to rule.** Phase 1 should not promise a card-height
figure before it is ruled.

Screenshots: `p0-height-1240.png`, `p0-height-1920.png`, `p0-height-3440.png`.

---

## 4. R4: Summary editable

Summary renders as a `<DIV>` with **0 controls**. The delta is an inline
editor plus the existing `PATCH /api/contacts/:id` path, and the door
must reach it because it becomes a write.

Its content is **42px**, the shortest of the three columns, so **R4 costs
height rather than saving it** - an editor is taller than a paragraph.
Worth stating beside R3: the two rulings pull opposite ways, and on a
lean card the Summary column has 192px of slack before it would drive
anything.

---

## 5. R5: the layout deltas, measured

| | measured | R5 wants |
|---|---|---|
| the action row | on its **own row** below the head | on the **top line, middle** |
| Created Date ends at | `x=724` | Notes to start here |
| Notes column starts at | `x=832` | **108px to close** |
| Company/Source/Created Date | already on the name line | keep |

---

## 6. R6: the New Lead grid

| | fields |
|---|---|
| grid today (**8**) | name, company, jobRole, industry_id, email, mobile, source, summary |
| the server **requires** (7) | name, company, jobRole, email, mobile, industry_id, source |
| `POST /contacts` also **accepts** (**7 more**) | **linkedin, address, address2, city, postcode, country, region** |

**The grid is 8 of 15.** R6's delta is those seven, all but one of them
the address group.

**And R6 and R1 point the same way.** Both are about a lead being
completable without going somewhere else: the grid so a lead can be
entered complete, the popup so an incomplete one can be finished in
place. The same seven fields appear in both.

---

## 7. Decisions Phase 1 needs

1. **R3 versus R7** - section 3. Recommended: take the achievable
   savings, let the remainder fall out of the follow-up-entity round.
   **Phase 1 should not commit to a height figure until this is ruled.**
2. **The address popup is card-local** and duplicates address editing
   while Lead Detail stands, like `NurtureDialog`. Confirm that is
   accepted rather than discovered.
3. **R1's popup: which fields does it offer?** All nine that block, or
   the blocking set plus nothing else? Recommended: exactly the server's
   blocking list, so the popup cannot drift from the gate - the same
   principle that already governs what it displays.
4. **R4 costs height while R3 asks for less.** Confirm R4 proceeds
   knowing that.

---

## 8. What this phase does not establish

- Nothing was built and nothing changed. No source differs from
  `95f4f92` except this report.
- **The follow-up panel was not measured as a target** and is named only
  as the third column's content, which was needed to answer R3 honestly.
- The busy-card case was measured with 10 notes and a long summary. A
  card with an open address popup was not measured, because the popup
  does not exist yet.
