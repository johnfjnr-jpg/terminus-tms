# Phase 0: measurement

Read-only. Nothing built, nothing pushed. The follow-up panel was not
touched and Lead Detail was not opened.

**R1 is worse than the walk described: there are THREE vintages of truth
on one panel, not one stale thing.** Section 1.

---

## 1. R1: what is stale, and where it is computed

### The instrument

The surface's stars carry `data-testid="lead-needs-<key>-<id>"`, so "which
fields are marked" is readable from the DOM without inference, and "what
the server says is missing" is readable from `exit-criteria`. **The claim
is that the two agree after a save; the measurement is the two lists side
by side.**

### Measured, on a lead missing address, postcode and summary

```
BEFORE  markers: [address, postcode, summary]
        server:  [address, postcode, summary]        agree

  ... fill `address`, press Save and continue ...

AFTER   markers: [address, postcode, summary]        UNCHANGED
        server:  [postcode, summary]                 correct
        message: "Saved. 2 still to complete."       correct
        values:  address=""  postcode=""  summary="" EMPTY
persisted in the database: address="12 Recompute Road"
```

### THREE VINTAGES, not one

| what | vintage | correct? |
|---|---|---|
| the **markers** | **open time** | **no** - `address` keeps its star |
| the **values** | **open time**, and local edits cleared | **no** - the box is EMPTY while the record holds the value |
| the **count** | **fresh**, re-fetched during the save | yes |

**The value staleness was not in the walk's description and is the worse
half.** The screen shows a **star on a field whose box is empty**, while
the database holds what was just typed. A person would reasonably
conclude the save failed and retype it.

### Where it is computed, and why it does not refresh

`blocking` is state in **`LeadCardActions`**, set in exactly one place:

```js
const pressQualify = async () => { ...
  const missing = r.data?.blocking ?? []
  setBlocking(missing)          // <- the only writer, at OPEN time
```

`QualifyCompletion` receives it as a **prop** and has no way to update it.
The surface **does** re-fetch `exit-criteria` inside its own save, but
uses the answer only for the message and the proceed decision:

```js
const left = again.data?.blocking ?? []
if (left.length) { setError(`Saved. ${left.length} still to complete.`)
                   setValues({}); return }
```

**So the fresh answer is fetched and thrown away** except for its length.
That is why the count is right and the markers are wrong - **the same
request already carries what the markers need.**

**And the values go stale for a second, separate reason**: `setValues({})`
drops the local edits, so every field falls back to `current` - the
payload prop - and `current` is only refreshed by `onSaved`, which this
path does **not** call on a partial save.

---

## 2. R1 cross-surface: the address popup

```
AFTER POPUP markers: [address, postcode, summary]    UNCHANGED
            server:  [summary]                       correct
            values:  address="12 Recompute Road"  postcode="049999"
```

**Values DO refresh** - John saw this correctly - because the popup's
`onSaved` calls `load()`, which reloads the list and so the payload prop.

**The markers do not.** `blocking` lives in `LeadCardActions` and nothing
in the popup path touches it, so after the popup save **two stars are
wrong** rather than one.

**So the two paths are stale in different ways**, which is worth stating
because a single fix must cover both: the in-surface save leaves values
AND markers stale; the popup leaves markers stale over correct values.

---

## 3. R2: two editors, confirmed, with independent state

| | |
|---|---|
| completion surface editor | present, `<TEXTAREA>` |
| card Summary panel editor | present, `<TEXTAREA>` |
| both save controls present | yes - `lead-fix-save` and `lead-summary-save` |
| **independent copies** | **yes** |

Typing `"typed into the surface"` into the surface's Summary left the
card's showing `""`. **They do not share state.** Two editors, two drafts,
two save buttons, one field - and whichever saves last wins silently.

Visible in `p0-two-editors.png` and in `p0-after-save.png`, where the
card's Summary panel sits directly below the surface with its own editor
and SAVE.

---

## 4. R2's consequence: the Summary-only case IS reachable

```
a lead complete but for Summary blocks on: [summary]
Summary-only case is reachable: true
the surface today shows 15 inputs and 1 marker
```

**So the case arises and must be handled.** With R2 applied the Summary
editor goes, leaving **14 inputs, all of them already filled, and a star
on the one field with nowhere to type.**

**That is the confusing surface R2 names**, and it is not "an empty
surface" - it is worse: a full surface of complete fields with a single
unreachable requirement. The person's eye has nothing to land on.

---

## 5. Decisions Phase 1 needs

1. **Where the refreshed `blocking` should live.** The surface already
   fetches it; the state is the parent's. Recommended: **the parent owns
   `blocking` and passes a refresh callback**, so both the in-surface save
   and the popup path call one thing. A second copy in the child would be
   the two-readers fault this round exists to remove.
2. **The value staleness (section 1) is not in R1's wording** but is on
   the same surface and the same save. Recommended: **fix it with R1** -
   after any save the surface shows the record, so the values must come
   from a reloaded record rather than from a cleared local draft.
   Confirm that is in scope.
3. **What the Summary-only surface says.** Recommended: the surface
   renders its normal panels with Summary starred and **a line naming the
   card's Summary panel as where to write it**. Alternative: skip the
   surface entirely and focus the card's Summary editor. **John's call** -
   the first keeps one flow, the second is fewer steps.

---

## 6. What this phase does not establish

- Nothing was built. No source differs from `59354f1` except the brief
  and this report.
- **The count was correct in every reading taken**; no case was found
  where it disagreed with the server. It is fresh because it is read from
  the same response the markers ignore.
- The measurements used one lead missing three fields and one missing
  only Summary. **A lead missing nothing is not reachable through this
  surface** - it goes straight to the account step - and was not measured.
- **The door was not re-measured this phase.** R2 removes an editor, which
  removes a write; nothing here adds one.
