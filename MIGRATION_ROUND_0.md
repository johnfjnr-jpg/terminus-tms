# Migration Round 0: scoping

**Written 2026-09-05. SCOPING ONLY - no product code was written, and none of
this commits the business to the migration.** The decision follows the reading,
not this document.

Every number here was measured from the running system on 2026-09-05. Where a
figure is an estimate it says so.

Item 1's deliverable is `MIGRATION_FIELD_ROW_CONTRACT.md`, kept separate because
it outlives this report: it is the behaviour a replacement is verified against.

---

## 1. Field-row behaviour enumeration

See `MIGRATION_FIELD_ROW_CONTRACT.md`. In summary: **five implementations, 81
display rows on default tabs (68 click-to-edit, 13 read-only), seven behaviours
each must satisfy.** The consolidation from five to one is the largest
structural win available, and the place where behaviour is most likely to be
silently lost - which is why the contract is written before anything moves.

---

## 2. React test model, and the real cost

| layer | measured | verdict |
|---|---|---|
| `src/lib` (5,530 lines) | 0 external imports; 12 server routes and 20 test files consume it | **moves untouched** |
| pure test blocks, behavioural | **323** | **move untouched** |
| pure test blocks asserting frontend SOURCE | **106** | **rewritten** |
| database tests | 9 files, 92 tests | **unchanged** |
| HTTP probes | 14 gate stages | **unchanged** |
| browser probes | 22 | **rewritten** |

**`src/lib` is confirmed isomorphic.** No Node-only and no DOM-only imports at
all. It is consumed by the server today and would be shared with a React client,
so the calculator, the version evaluator, the defaults engine and the rate
resolution move for free and keep their 323 tests.

**The cost is the 106 and the 22.** The 106 are assertions of the form "this
string appears in `app.js`" - `class-rules`, `commercials-wiring`,
`decision-surface`, `opportunity-headline` and thirteen others. They are not
weak: several caught real defects this round, including two of my own before
they shipped. But they are coupled to the vanilla implementation **by
construction** and have no meaning after it.

**They must be re-derived, not translated.** `CLAUDE.md` Verification 47, earned
twice in this round: a fixture shaped to the implementation tests the
implementation. Component tests written from the new components will reproduce
that fault at scale, and the field-row contract exists precisely so the
replacements have an independent source.

**Test cost: ~128 assertions rewritten, ~75% of the estate untouched.**

---

## 3. Strangler feasibility (Option B, Vite shell) - assessed, not built

**Nothing forces a big-bang.** Fastify serves `frontend/` as static files with
API routes taking priority; a Vite bundle can be served alongside at its own
route and the shell can mount React per view.

**What couples the frontend into one unit:** **126 `window.*` exports** and
**101 inline `onclick=`** handlers (20 in markup, 81 generated in JS). An inline
handler requires `window.foo` to exist, so a strangled module must keep
exporting whatever other modules' handlers still call.

Measured coupling gives the order without judgement:

| module | globals exported | inline references from elsewhere |
|---|---|---|
| `opportunity-approval.js` | 1 | **0** |
| `opportunity-deal.js` | 3 | 2 |
| `account-detail.js` | 5 | 14 |
| `opportunity-reference.js` | 10 | 40 |
| `contact-detail.js` | 15 | 59 |
| `test-bed-detail.js` | 25 | 75 |
| `app.js` | 67 | **288** |

**First surface: the approval view.** 253 lines, one global, **zero** inline
references from anywhere else, read-mostly, and it exercises the shared `src/lib`
evaluator. It can be reverted without touching another file.

**Then Commercials** - 2,797 lines and still only 2 references, and it is where
most of Round 41's work and most of its value sits. **Then** Account →
Reference → Contact → Test Bed, ascending coupling. **`app.js` last**: it is the
shell and router and 288 inline references point at it.

---

## 4. Estimate

**13-16 rounds.** Above the earlier 11-14, and the revision is the 106, which
had not been measured before.

| block | rounds | what drives it |
|---|---|---|
| shell, routing, auth, the field-row component + its contract-derived tests | 3-4 | seven behaviours × verification against 81 rows |
| six surfaces in coupling order | 5-6 | Commercials is two on its own |
| rewriting 106 coupled assertions, re-pointing 22 browser probes | 2-3 | selectors change everywhere |
| unwinding 126 globals and 101 inline handlers | 2-3 | the tail nobody estimates and everybody pays |

---

## 5. The payoff, in this round's evidence

The case must rest on named defects from Round 41, not on preference.

### A query/cache layer makes these structurally impossible

| defect | why |
|---|---|
| **U9/U10** held revision goes stale, the write is refused | invalidate-after-mutation refreshes the holder; no hand-rolled `oppLoadedRevision` |
| **Three modules each holding a private revision** (Round 38) | one cache entry per key - there is no second copy to drift |
| **Five copies of `warrantyPct`, three of `targetMargin`** | same |
| **The poll's silent failure** (`if (!r.ok) return`) | `isError` / `failureCount` are first-class state; a failing query cannot be invisible |
| **U12** the rejection outcome vanishing when the request closed | invalidation re-renders every reader from one source |

### React's rendering model - NOT the cache - removes two more

| defect | why |
|---|---|
| **The read-only sweep writing `disabled = false`** over controls a render had deliberately disabled | derived rendering has no second writer of a DOM property |
| **The decision handler bound to another banner's ids** | component-scoped refs, not `getElementById` |

### It removes NONE of these

Every one was a server-side modelling or logic error and would have happened
identically:

| defect | why the cache is irrelevant |
|---|---|
| **The version/approval join on `revision_number`** | the server returned wrong data; a cache stores it faithfully. **The round's most expensive defect** |
| **W1** probability not re-derived by the SQL mover | the route was not the mover |
| **W2** reviews never closing; supersession | server lifecycle |
| **U11** approval requestable on an approved version | server enforcement |
| **Reject-on-approved; the constraint failures; the scope matrix** | server |
| **U1** numeric inputs accepting text | validation |
| **Rapid clicking swallowing sibling approvals** | handler design |

### The honest verdict

**Of roughly 20 defects this round, a query layer prevents five and React's
rendering model prevents two. The other thirteen would have happened
identically.**

That is a real payoff and a narrower one than the round's defect list suggests.
**If the decision rests on defect prevention alone, the number is 7 of 20, and
that is not sufficient on its own.**

The defensible case is the two together:

- **seven named recurrences prevented by construction**, and
- **five field-row implementations becoming one**, which is where the behaviour
  drift in items 1 and 2 actually lives.

**The migration's case is the duplication, not the bugs.**
