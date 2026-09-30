# TEST_LOG_1, PHASE 0

Short, as briefed. **No premise failed**, so the round proceeds. One measured
constraint in 0.B is carried forward rather than stopped on, and the position
taken is stated.

0.1 to 0.5 are answered in the addendum and census reports and are not redone.

---

## 0.A THE READERS OF A TYPE'S INSTALLATION PRICE UNDER OPEX

**There are two, and they are the defect.**

| # | reader | where | what it names |
|---|---|---|---|
| 1 | the fee ALLOCATION | `deal-inputs.js:500-502`, `OPEX_LINES[type].in` | `['inSsEx','inSsNew']` resolved through `lineBase()` over `installLineItems` |
| 2 | the OPEX TABLE | `opex.js:42` `INSTALL[type]`, and `opex.js:46-50` `INSTALL_RATES[type]` via `lumpShare` | the same per-unit keys, **or** the type's share of `inLump` |

Measured on one deal, 21 SafeSight units, 60 months, a stored $500 fee:

```
                    reader 1 (allocation)   reader 2 (opexRows)   agree?
PER UNIT                    56,652.00            56,652.00         yes
LUMP SUM                         0.00           394,361.34         NO
```

**Under per-unit they agree exactly.** Under lump sum reader 1 sees **nothing** -
`inSsEx` and `inSsNew` do not exist as line items, so `lineBase()` returns
`{cost: 0, price: 0}` and the allocation scales a row with no installation in it
- while reader 2 adds the type's share of the lump. The difference IS the gap.

### The one function R-TL1 converges on

**A single exported `installPriceFor(type, ...)` in `src/lib/opex.js`**, imported
by `deal-inputs.js`.

**In `opex.js` and not the other way round**, for two reasons that are facts
rather than preferences:

- `opex.js` already owns the lump-sharing knowledge (`INSTALL_RATES`, the weight
  fallback to unit count, and the position recorded there as John's to overturn).
  Moving that INTO `deal-inputs.js` would move a ruling with it.
- **the import already runs that way**: `deal-inputs.js:37` imports
  `OPEX_FEE_KEYS` from `opex.js`, and `opex.js` imports nothing from
  `deal-inputs.js`, so this direction adds no cycle.

### The rounding tolerance, declared

Per-unit already misses by **-29.00** on the deal above, and that is not new: it
is whole-dollar rounding on each scaled line, **dominated by the hosting line**,
which is rounded per month and then multiplied by the term.

```
hosting      +/- 0.50 x 60 months          =  +/- 30.00
one-off lines  +/- 0.50 x 3 lines          =  +/-  1.50
declared tolerance                            +/- 31.50
```

**R-TL1's equality is asserted within that band**, and the band is derived from
the term rather than picked: at 24 months it is +/- 13.50, at 60 it is +/- 31.50.
Asserting exact equality would be asserting that whole-dollar prices can express
an arbitrary fee, which they cannot.

---

## 0.B KEY CUSTOMER CONTACTS, MEASURED

```
                     1920          1240
panel  (.pg-card)    1556          876
TABLE                 739          739       <- content-sized, does not stretch
unused panel          817          137
stance note           150          150       (computed, both)
double would be       300          300       (+150px needed)
```

Columns, identical at both widths: Contact **117**, Role **136**, Stance **298**,
Linked **152**, actions **35**.

### THE CONSTRAINT, AND IT IS 13 PIXELS

**At 1920 doubling the note is free**: 150px needed against 817px unused.

**At 1240 it does not fit.** 150px needed against **137px** unused - short by
**13px**. The table is content-sized rather than stretched, so growing the note
by 150 takes the table to ~889px against an 876px panel.

**NOT STOPPED, and the position taken is stated rather than assumed.** W-TL2 is
your named cosmetic item, so widening the note is approved; what is not approved
is *another* column moving to make room. So Phase 1 measures the consequence
rather than predicting it - widen, then read the table and panel at 1240 - and
if the table genuinely overflows, that is a layout change beyond the instruction
and it **stops and photographs** per the standing rule.

### The Linked column's format, source named

`KeyContacts.tsx:307` renders `formatTimestamp(l.linked_at)`, from
`src/lib/format-dates.js:63`, which returns **`dd/mm/yyyy HH:MM:SS`**. Read live:
**`30/09/2026 14:03:41`**.

`formatDate` in the same module returns `dd/mm/yyyy`. **W-TL2 is a one-word
change of function at one call site**, and `formatTimestamp` stays for the
callers that want a time.

---

## 0.C A FOLLOW-UP CONCEPT EXISTS. REPORT ONLY

**Yes, and it is already wired into a gate.**

| | |
|---|---|
| UI | `frontend-react/src/contact/FollowUpTask.tsx`, surfaced through `OpportunityBand`'s `followUp` slot |
| storage | **payload keys**, `followUpDate` and `followUpDescription` - **no table, no column** |
| writable | on EVERY status, `src/routes/contacts.js:424` |
| gated | a `stage_gate_rules` row requires `followUpDate` for the contact (`opportunities.js:581`) |

**What does NOT exist:** any `tasks` table, any `next_action` concept, and any
list or queue across records. It is **two fields on one record**, rendered as one
panel because "a task is two fields saved together and read as one thing".

**No finding is claimed and nothing is proposed.** W-TL3 asked whether the
concept exists; it does, in the narrowest possible form.
