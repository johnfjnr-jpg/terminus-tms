# Perf round (contacts-fetch): close-out

Branch `perf-1`, off `main` at `b034948`, confirmed equal to `origin/main`.

---

## RECONCILED BY COUNTING

| | Commit |
|---|---|
| Brief and Phase 0 | `8cfb87e` |
| Step 0 riders | `1740b55` |
| The build: one fetch per page load | `200e60d` |
| Close-out and `CURRENT_STATE.md` | this commit |

**Rulings in force: 1**, the perf round instruction, whose Step 0 riders were
ruled in it. Nothing was ruled in conversation during the round.

**`CURRENT_STATE.md` records the tree as dirty, and the only dirt is
`prototypes/deal-sheet-option-c.html`** - untracked, not written by this
session, and deal sheet reorganization is excluded from this round. It is
left exactly as found.

---

## THE RESULT

| | before | after |
|---|---|---|
| **boot** | **5** | **1** |
| leads list (navigate) | 2 | **0** |
| contacts list (navigate) | 2 | **0** |
| test bed detail | 1 | **0** |
| contact detail | 1 | 1, and it must be |
| opportunity detail | 1 scoped | 1 scoped, unchanged |
| **total across 10 view loads** | **18** | **8** |
| contact detail settle | 3,363ms | **2,526ms** |

Boot measured **1 of 1 on five consecutive runs**, deterministic.

---

## PHASE 0, AND IT CORRECTED THREE OF MY OWN NUMBERS

The round's premise came from my walk-10 diagnosis. Re-measured on a quiet
machine:

| clause | walk 10 | measured |
|---|---|---|
| tail | 21.6s | **2.37s** worst of 30 |
| concurrency | "several concurrent copies" | **max 2 in flight**; 8 concurrent cost x1.1 each |
| sites | "eight unscoped client sites" | **nine**, seven GET, one already scoped |

The 21.6s was taken while thirteen spinning pollers were running, which the
same round recorded as taking a settle from 3,045ms to 12,050ms.
**Verification 26: a measurement became an instruction and nobody re-checked
what it rested on.** The finding survived all three corrections.

### The mechanism, separated rather than assumed

- **Not concurrency.** 8 concurrent copies cost **x1.1** each.
- **Not payload.** The scoped call costs **736ms for 2,764 bytes and two
  rows** against 867ms for 24,944 bytes and seventeen.
- **The route's own sequential work**: five to six round trips in series,
  against **119ms** for a one-trip route.
- **So the pile-up costs DRAWS FROM A HEAVY TAIL.** P(one draw > 1200ms) is
  7%; P(slowest of five > 1200ms) is **29%**.

**The route's own ~870ms is a separate finding and a separate round.**

---

## THE BUILD

**One mechanism, not two.** `fetchQuery` already deduplicates in flight and
serves inside a stale window; a second promise cache beside it would be
Verification 20's two readers by construction.

**Bridged to the vanilla**, because one fetch per load cannot be met by two
independent caches: four of the five boot fetches were `loadContactsData`, so
a cache the shell could not reach would have left all four standing.
`window.tmsContacts` is published for the same reason `tmsFormatDate` already
is, one step further - that is a helper that must not have two
implementations, this is a **request that must not be made twice**.

**Five React readers share one key.** `ContactView`'s was
`['contact', contactId]`, a per-contact cache entry for a whole-estate
resource, and is now the shared key with a selector.

**FRESHNESS IS A PROPERTY OF THE WRITE, NOT OF THE STALE WINDOW.** Every
post-write reload passes `force`, which invalidates first: four in `app.js`,
`ContactHost`'s registered reload, and `LeadsList`'s four save paths. Without
it a save inside the window would repaint the value it replaced, which is the
one way a shared cache is worse than none.

**`KeyContacts` keeps its scoping** and no consumer changed what it displays.

---

## STEP 0 RIDERS

1. **Three `whtPct` labels unify on `WHT %`.** Display maps only; nothing
   persists them, so no frozen version snapshot moves. `version-pricing`'s
   own map already said `WHT gross-up` two lines below.
2. **The Opportunity assessment panel says Save, Saving, Saved.** A **fifth**
   occurrence went with the four ruled: the counter beside the button read
   "assessments ready to record", and leaving it would have put that next to
   a control saying Save.
3. **`pg-total-{cost,price}-hw` become `pg-total-{cost,price}-oneoff`.** Both
   move, not the price alone: walk 11 D3 put installation on that card, so
   both totals stopped being hardware. Four dependents re-pointed.

---

## WHAT THE ROUND FOUND IN ITS OWN WORK

1. **The fetch guard refused my first Phase 0 probe**, and it was right for a
   reason that is sharper in a performance probe than anywhere else: a raw
   `fetch` does not throw on a non-2xx, so **a 401 would have been timed as a
   fast success** and read as a healthy sub-second route. In a correctness
   probe a silent error reads as a wrong answer; here it reads as good news.
2. **The guard read TWO boot fetches when the product made one.** Setting the
   session AFTER the document exists boots the signed-out page, and the
   reload then catches its request: the harness counting two boots as one.
   **Verification 45** - seeded with `evaluateOnNewDocument`, it is 1 of 1 on
   five runs. It read exactly like the product failing to deduplicate.
3. **Thirteen test harnesses lacked the `QueryClientProvider` that production
   wraps every `ShellProvider` in.** A host reading the client worked in the
   app and threw in the suite. Verification 47: the harness reproduces how
   production INVOKES the code. A fresh client per render, so one test's
   cached list cannot answer for the next.
4. **My first wrap of those harnesses put the closing tag outside the `act`
   callback**, breaking nine files. Reverted from `HEAD` and redone with a
   replacement that anchors on the first `<ShellProvider` and the last
   `</ShellProvider>` on the line.
5. **The seam census refused the new global until it was recorded**, which is
   Verification 19's own remedy working rather than an obstacle.

---

## Exit gate

| Point | Answered |
|---|---|
| Phase 0 measured before anything changed | **Yes**, on untouched `main`, and it corrected three of my own numbers |
| (a) request count and timing per view | **Yes**, both widths, request log read |
| (b) all nine consumers named, with what each uses | **Yes**, and four throw away almost everything they ask for |
| (c) concurrency vs payload vs route, separated | **Yes**, by measurement: x1.1 at N=8, 736ms for 2.7KB, 119ms for a one-trip route |
| ONE fetch per page load serving all consumers | **Yes.** Boot 5 to 1, 1 of 1 on five runs |
| Scoped consumers keep their scoping | **Yes**, and a calibration injection proves the guard sees it |
| No consumer changes what it displays | **Yes.** Every post-write path forces |
| Red-first guard, calibrated by un-deduplicating | **Yes. 5/5**, three injections each firing on its NAMED check |
| A latency assertion on the measured route | **Yes**, min of 8 against a ceiling taken from the requirement, not the result |
| Live proof at 1440 and 1240, request log read | **Yes. 13/13** |
| Before/after timings | **Yes**, in the table above |
| `CURRENT_STATE.md` regenerated | **Yes**; it records the tree dirty, and the dirt is the untracked prototype file |
| Merged or pushed | **No push from the session** |
