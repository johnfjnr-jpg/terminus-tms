# Perf round (contacts-fetch): the brief, and Phase 0

Branch `perf-1`, off `main` at `b034948`, confirmed equal to `origin/main` by
`git ls-remote`. Rule 18 governs: this round ends "ready for John's push".

**An untracked `prototypes/deal-sheet-option-c.html` appeared in the tree at
21:33, not written by this session.** Deal sheet reorganization is excluded
from this round, so it is left exactly as found and not committed.

---

## PHASE 0, AND IT CORRECTS ONE OF MY OWN NUMBERS FIRST

The brief cites my walk-10 diagnosis: *"tails to 21.6s, several concurrent
copies per page load from eight unscoped client sites."*

**Measured again on the quiet machine, two of those three clauses need
correcting, and the finding survives both corrections.**

| clause | walk 10 | measured now |
|---|---|---|
| tail | **21.6s** | **2.37s** worst of 30 serial draws |
| concurrency | "several concurrent copies" | **max 2 in flight**, and 8 concurrent cost x1.1 each |
| sites | "eight unscoped client sites" | **nine call sites**, seven of them GET, one already scoped |

**The 21.6s was measured while thirteen spinning poller shells were running**,
which the same round recorded as taking a page settle from 3,045ms to
12,050ms. It is a real reading of a loaded machine and it is not the route's
behaviour. Verification 26: a measurement became an instruction without
anybody re-checking what it rested on, and the person who wrote it was me.

---

## (a) REQUEST COUNT AND TIMING PER LOAD

Fresh page per view, request log read from the browser, both widths.

| view | full-list GETs | notes |
|---|---|---|
| **boot (reload onto the landing view)** | **5** | the finding |
| leads (navigate) | 2 | |
| contacts list (navigate) | 2 | |
| contact detail | 1 | |
| opportunity detail | 1 | **scoped**, W3's picker |
| test bed detail | 1 | |

Per-request cost on the quiet machine, 30 serial draws through the estate's
throwing client: **749ms min, 867ms p50, 1,227ms p95, 2,368ms max**, spread
3.2x, 24,944 bytes for 17 contacts.

### The boot's five, named by their initiator stacks

```
loadContactsData <- navigate <- showApp <- _notifyAllSubscribers
loadContactsData <- navigate <- showApp <- init
loadContactsData <- navigate <- showApp <- _notifyAllSubscribers
loadContactsData <- navigate <- showApp <- init
Bc <- El <- Tl <- El                       (the React bundle's query)
```

**Four of the five are the same vanilla function**, because `showApp` calls
`navigate` four times during boot - twice from Supabase's auth
`_notifyAllSubscribers` and twice from `init` - and `navigate` calls
`loadContactsData` for both the `leads` and `contacts` views.

`loadContactsData` already carries a load TOKEN and drops the stale RENDERS.
**It does not drop the stale REQUESTS**, so three of the four are paid for in
full and thrown away.

---

## (b) THE NINE CONSUMERS, AND WHAT EACH ACTUALLY USES

| # | consumer | style | asks for | uses |
|---|---|---|---|---|
| 1 | `app.js:5148` `loadContactsData` | raw, once per `navigate` | full list | both contact grids |
| 2 | `ContactHost.tsx:165` | raw `shell.api` | full list | **one record**, `.find(c => c.id === contact.id)` |
| 3 | `ContactView.tsx:36` | `useQuery(['contact', contactId])` | full list | **one record**, `.find(...)` |
| 4 | `LeadsList.tsx:66` | raw, in a `Promise.all` | full list | lead rows |
| 5 | `TestBedHost.tsx:255` | raw | full list | **one account's**, `.filter(parent_record_id === installerAccountId)` |
| 6 | `TestBedHost.tsx:337` | raw | full list | **one account's**, `.filter(parent_record_id === accountId)` |
| 7 | `KeyContacts.tsx:142` | raw, **`?account_id=`** | one account | picker options. W3's, and it stays scoped |
| 8 | `NewLeadGrid.tsx:146` | POST | - | a write, not part of the pile-up |
| 9 | `app.js:3007` | POST | - | a write, not part of the pile-up |

**Four of the seven readers throw away almost all of what they ask for**, and
`ContactView`'s query key is `['contact', contactId]` - a per-contact cache
key for a whole-estate resource, so the cache cannot share between contacts.

---

## (c) WHY THE TAIL: not concurrency, and not payload

```
N    each: min / median / max      wall    per-request cost vs N=1
 1     868 /    868 /   868 ms       868ms   x1.0
 2     776 /    916 /   916 ms       917ms   x1.0
 4     786 /    872 /  1144 ms      1145ms   x1.0
 8     787 /    964 /  1342 ms      1343ms   x1.1
```

**Eight concurrent copies cost x1.1 each. They do not contend.** So the
pile-up does not make any single request slower.

**Payload is not it either**: 24,944 bytes, and the SCOPED call still costs
**736ms median for 2,764 bytes and two rows**, so a ten-times-smaller answer
costs about the same and the cost is not row count.

**It is the route's own sequential work.** `GET /contacts` makes five to six
round trips in series - `records`, then every `record_revisions` row for those
ids, then `record_contacts` with an embed, then `accountsFor`'s two more -
against `/stage-definitions` at **119ms** and `/industries` at **120ms** for
one trip each. That is where ~750ms of a ~870ms request goes.

**So what the pile-up actually costs is DRAWS FROM A HEAVY TAIL.** Each
request is an independent draw, and a page waits for the slowest of them:

```
P(one draw > 1200ms)            =  7%
P(slowest of 5 draws > 1200ms)  = 29%
P(slowest of 2 draws > 1200ms)  = 13%
P(slowest of 1 draw  > 1200ms)  =  7%
```

**Five fetches make a slow boot five times more likely than one does**, and
that is the mechanism the build removes. On a loaded machine every term
inflates, which is how the same shape produced 21.6s in walk 10.

**The route's own 800ms is a separate finding and a separate round.** Fixing
it is a route rewrite, which is a scope change.

---

## A CONTROL CAUGHT THE MEASUREMENT ITSELF

The first version of `phase0-route.mjs` used a raw `fetch` and
`api-client.test.mjs` refused the commit. It was right, and the reason is
sharper in a performance probe than anywhere else: **a raw fetch does not
throw on a non-2xx, so a 401 would have been timed as a fast success** and
reported as a healthy sub-second route. In a correctness probe a silent error
reads as a wrong answer; here it reads as GOOD NEWS.

Re-run through `api()`, which throws, every number above holds.

---

## The build, to the measurement

- **Vanilla**: one in-flight-deduplicated helper, so four boot calls become
  one request.
- **React**: one shared query key with a sane `staleTime`, so the five
  full-list readers share a single fetch.
- **The two are bridged**, because "one fetch per page load serving all
  consumers" cannot be met by two independent caches: the bundle publishes the
  deduplicated accessor and `app.js` calls it, which is the direction the
  migration already runs in.
- **`KeyContacts` keeps its scoping.** No consumer changes what it displays.
