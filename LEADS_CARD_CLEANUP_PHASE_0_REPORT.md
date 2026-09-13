# LEADS CARD CLEANUP, Phase 0: targeted confirmation

Read-only. A prior Phase 0 exists; this confirms the specific items rather
than re-measuring wholesale. One live probe, one static census.
`check-dist-fresh.mjs` PASS before the live read.

---

## The headline: TWO CORRECTIONS to the prior Phase 0's reading of R2

**Confirming was worth the one run.** Both corrections change what Phase 1
should build.

### Correction 1: the cells DO have a border

The prior report said *"the cells have no border at all"*. **False.**

| element | bottom border |
|---|---|
| `th` | **1px `rgba(242,242,240,0.12)`** |
| `td` | **1px `rgba(242,242,240,0.12)`** - the same |
| `input` | 1px `rgba(242,242,240,0.22)` |
| `select` (empty, required) | 1px **`rgba(242,100,100,0.9)`** |

**The prior probe asked for the `border` SHORTHAND, which computes to `""`
whenever the four sides differ.** A cell with a bottom border and no sides
reads exactly like a cell with none. **Verification 4's family: the
property was real and the question was wrong.**

### Correction 2: only ONE of the three lines is a defect

John's words - *"field underline != dropdown underline != row line"* - are
**exactly right, three distinct treatments**, and the causes differ:

| line | verdict |
|---|---|
| `th` and `td` at 0.12 | **correct and already consistent** - the table's own lines |
| **`input` at 0.22** | **THE DEFECT.** The field underline does not match the cell line it sits on, so a filled cell shows two lines at different weights |
| `select` in red | **CORRECT AND DELIBERATE.** `.new-lead-table [aria-invalid="true"] { border-color: rgba(242,100,100,0.9) }` - an empty required field marked invalid |

**So the fix is not "add cell borders".** They exist. It is **align or
remove the input's own underline inside a table cell**, because the cell
line already does that job. **The red stays**: it is validation, not
inconsistency, and removing it would delete a working signal.

---

## 1. R2: the rest, confirmed unchanged

| measurement | prior | now |
|---|---|---|
| columns | 15 | **15** |
| modal width | 1480 | **1480** |
| input width | 110 | **110** |
| cell width | 118 | **118** |
| content width of a 58-char name | 370 | **370** |
| cropped | true | **true** |
| scrolls | false | **false** |

**The scroll cause, read from the computed style rather than inferred:**
`.new-lead-scroll` has `max-height: none` and `flex: 1 1 0%`, inside a
modal capped at `1056px` (88vh at this viewport). **With 7 rows,
`scrollHeight 424 === clientHeight 424`: the container grows, so there is
nothing to scroll and no bar to show.**

**A note for Phase 1's own test**: Save stayed **disabled** with only the
`name` column filled, correctly - the server's mandatory set needs more.
**The save-closes-the-modal proof must fill a complete row**, or it will
measure a disabled button.

---

## 2. R3: the two locations, confirmed

| | |
|---|---|
| the block to drop | `QualifyCompletion.tsx:163-176`, testid `lead-summary-pointer-<id>` |
| the asterisk's new home | `InlineSummary.tsx:44`, `<Panel title="Summary">` |

**R3 says build it as the SURFACE's own logic so it carries into Round B.**
The mechanism that does that is **a `required` affordance on `PanelHeader`**
- the shared shell - rather than an asterisk hand-placed in
`InlineSummary`. Then any panel that must be completed says so the same
way, and Round B's account section inherits it.

---

## 3. R4: the gate's blind spot, confirmed and diagnosed

**The test, as written:**

```js
const RETIRED_SHELL = /className="[^"]*\b(card-col-head|cd-card-head|form-actions)\b/
```

**A list of three names.** `QualifyCompletion` renders
`lead-card-col-title`, `lead-complete-group` and `lead-complete-actions` -
**none of them on the list, so it passed.**

### The structural replacement

**Enumerate by PATTERN and by the shell's own vocabulary, so an unrecorded
instance fails by default:**

> **Any `className` on a Leads surface matching `/-(title|head|header|actions)\b/`
> must be one the shell emits** - `panel-title`, `panel-head`,
> `panel-secondary`, `panel-actions`, `panel-body`.

**That catches `lead-card-col-title` and `lead-complete-actions` today, and
a future `foo-header` without anybody adding it** - which is Verification
19's actual remedy: *fails on the unrecorded instance*.

**And the allowlist is derived from `Panel.tsx`, not retyped**, so the two
cannot drift.

### What routing `QualifyCompletion` through `Panel` touches

**Censused. The testids are the constraint.**

| hook | addressed by |
|---|---|
| `lead-incomplete-<id>` | **6 probe files** |
| `lead-fix-save-<id>` | **4** |
| `lead-fix-error-<id>` | 3 |
| `lead-incomplete-close-<id>`, `lead-missing-<id>`, `lead-needs-summary-<id>`, `lead-summary-pointer-<id>` | 2-3 each |

**Every testid must survive the routing.** Last round's lesson, at cost:
deriving a testid inside a shared control would have renamed
`lead-summary-save` and broken six probes as **timeouts that read like
product defects**. `Panel` already takes `testid` and `headerTestid`, so
this is achievable rather than a trade.

**The classes are cheaper**: `lead-complete-group`, `-grid`, `-cell`,
`-actions` and `lead-complete-surface` are referenced **only by
`style.css`.**

**BUT `lead-card-col-title` MUST NOT BE DELETED from the stylesheet.**
`NotesHistory`'s non-title path still renders it for its **frozen
consumers**, `ContactHost` and `TestBedHost`. **The three-consumer
constraint stands this round**, because `contact-detail` is not retired
here.

---

## 4. R1: no live reproduction, by ruling

**The cause is confirmed by John**: the "popup lists" are Chrome's own
autofill suggestions and the white highlight is the `:autofill`
pseudo-class, not app state.

**THE VERIFICATION LIMIT, stated here and to be restated in Phase 1:**

> **Headless Chrome cannot trigger autofill, so the probe CANNOT reproduce
> white-before and normal-after.**

**What Phase 1 CAN prove:**

1. the rule exists and targets `:autofill` on the card's inputs;
2. **no non-autofilled field's treatment changes** - a before-and-after
   census of every card input's computed background and border.

**What it cannot**: that an autofilled field now renders normally.
**That is John's observation, next time autofill fires**, and Phase 1 will
say so rather than implying a reproduction.

**Supporting evidence already measured**: `LeadFieldInput`'s five controls
carry no `autoComplete` attribute, and the stylesheet contains **zero**
`:autofill` or `-webkit-autofill` rules - so Chrome's default fill is
currently unopposed.

---

## Decisions Phase 1 needs

1. **R2's line fix**: align the input's underline to the cell's `0.12`, or
   **remove the input underline inside a table cell** and let the cell line
   carry it. **Recommended: remove** - one line per row edge is what makes
   it read as a table, and two lines 0.10 apart is what does not.
2. **R2's height cap**: a row count or a viewport fraction. **Recommended:
   a `max-height` in `vh` on `.new-lead-scroll`**, so the cap holds at
   1240 as well as 3440 rather than being tuned to one.
3. **R3's mechanism**: a `required` affordance on `PanelHeader`, so it is
   surface-owned and Round B inherits it. **Recommended.**
4. **R4's widened test**: pattern plus a shell-derived allowlist, as above.

---

## What this does NOT establish

- **R1's fix working**, for the reason ruled above.
- **Scroll-position reset**, which stays untestable until the cap lands -
  flagged again so Phase 1 verifies it **after** the cap rather than
  assuming the cap delivered it.
- **The save path**, which was not exercised: it creates live leads, and
  Phase 1 will do it with a teardown.
- **Anything about Round B.** `contact-detail` and the Contacts list were
  not touched or measured.
