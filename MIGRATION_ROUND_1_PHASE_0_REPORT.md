# Migration Round 1, Phase 0: investigation report

**2026-09-05. Investigation only. No product code was written, no tracked file
was modified other than the creation of this report, and nothing was pushed.**

Findings are named, not fixed. Three are recorded below; none of them is a
blocker on its own, and item 6 carries the one that needs a decision before
Phase 1 builds anything.

Everything here was measured. Where a search was used to establish an absence,
comments were stripped first with the repository's own `scripts/lib/strip-comments.mjs`,
per `CLAUDE.md` Verification 39 - a file that talks about its own code contains
every string a scan of that code looks for.

---

## 1. The `onSend` header hook over a second static prefix

**CONFIRMED. It covers `/app/` with no change.**

The hook, verbatim from `src/server.js:86`:

```js
fastify.addHook('onSend', async (request, reply) => {
  if (request.raw.url?.startsWith('/api/')) return
  reply.header('cache-control', 'no-store, must-revalidate')
})
```

**Why it covers a second prefix:** it is a hook on the root instance keyed on the
REQUEST URL, not a callback attached to a static plugin instance. It has no
knowledge of mounts at all, so a new mount inherits it by default rather than by
configuration. Its own comment already states this is why it exists: *"An onSend
hook is the plugin-independent place, and it covers BOTH static mounts from one
line rather than two callbacks that could drift."*

**The reason to prove it rather than read it** is registration order. The hook
sits at line 86, after two `register(FastifyStatic, …)` calls (lines 57, 67) and
before a third (line 119). A `/app/` mount would be a fourth, registered after
the hook, and Fastify's encapsulation makes "does a hook reach a plugin
registered later" a real question rather than an obvious one.

**Measured** with a standalone server replicating the exact shape - a mount
before the hook, the hook verbatim, then a `/app/` mount with
`decorateReply: false` after it:

```
/app.js         200  cache-control: no-store, must-revalidate   (mount BEFORE the hook)
/app/bundle.js  200  cache-control: no-store, must-revalidate   (mount AFTER the hook)
/api/ping       200  cache-control: (none)                      (correctly exempt)
```

The `/app/` case is the one Phase 1 needs and it passes. **No work required for
this item.**

---

## 2. Callers of `window.loadApprovalPage`

**CONFIRMED: exactly one caller, `frontend/app.js:186`.** As expected. No
finding.

```js
else if (view === 'opportunity-approval' && id) window.loadApprovalPage?.(id)
```

**A caution for whoever greps this next.** A naive search returns FOUR code
occurrences, and three of them are not callers:

| location | what it is |
|---|---|
| `frontend/app.js:186` | **the caller** |
| `frontend/opportunity-approval.js:199` | the definition, `window.loadApprovalPage = …` |
| `frontend/opportunity-approval.js:203` | `loadApprovalPageInner`, a different symbol containing the substring |
| `frontend/opportunity-approval.js:206` | the same inner function's declaration |

Reported because "4 occurrences" would read as "4 callers" and the round's
revert story depends on there being one.

---

## 3. Tests and probes referencing `frontend/opportunity-approval.js`

**CONFIRMED: exactly one, `scripts/tests/commercials-wiring.test.mjs:758`.** As
expected. No finding.

```js
const approval = readCode(new URL('../../frontend/opportunity-approval.js', import.meta.url))
assert.match(approval, /class="ds-row/, 'the approval page still uses these, so the rules stay')
```

It is a **liveness assertion for a stylesheet rule**: it keeps `.ds-row` in
`style.css` by proving something still uses it. Phase 3 item 2 re-points it, and
the brief is right that leaving it would pass against dead code.

**Two near-misses, correctly excluded, stated so the enumeration is checkable:**

- `frontend/index.html:3209` - `<script src="/opportunity-approval.js">`. This is
  the load site, not a test. Phase 1 removes it in the same commit that registers
  the React bundle.
- `scripts/tests/approval-page.test.mjs` - 12 references to `buildApprovalPage`,
  but that is **`src/lib/approval-page.js`**, the endpoint's lib. It does not
  touch the view file and does not move.

A looser search across all of `scripts/tests` and `scripts/probe-*` for
`opportunity-approval`, `loadApprovalPage`, `buildApprovalPage` and `appr-frame`
returned nothing else.

---

## 4. Vite + React + TypeScript importing `src/lib` untouched

**CONFIRMED. Built, inspected, and the scaffold is deleted.**

A throwaway `frontend-react/` workspace was created at the repo root - so the
real `../../src/lib/*.js` relative import was exercised rather than a simulation
of it - importing `version-approval.js`, `deal-calculator.js` and
`approval-page.js`, with a React root rendering alongside.

```
vite v8.2.2 building client environment for production...
✓ 22 modules transformed.
dist/assets/main-CCHBKtfj.js  573.44 kB │ gzip: 120.42 kB
✓ built in 63ms
```

No alias, no `server.fs.allow`, no TypeScript path mapping: a plain relative
import across the workspace boundary resolved and bundled.

**Positive control first, because an absence check on an empty bundle proves
nothing** (Verification 13). All six `src/lib` symbols are present in the output:

| symbol | occurrences |
|---|---|
| `versionApprovalState` | 3 |
| `linkApprovalsToVersions` | 2 |
| `calculateDeal` | 6 |
| `buildApprovalPage` | 2 |
| `checkReconciliation` | 2 |
| `frozen_version_id` | 3 |

**Node-only constructs in the output: none.**

`require(` 0 · `node:` 0 · `__dirname` 0 · `__filename` 0 · `process.binding` 0 ·
`from 'fs'` 0 · `from 'path'` 0 · `createRequire` 0

**One honest qualification.** The bundle contains four `process.emit`
references, all inside the guard `typeof process && "function" === typeof process.emit`.
That is React DOM's error-reporting **feature detect**, not a Node import: in a
browser `process` is undefined and the branch short-circuits. It is reported
rather than rounded to zero, because "no Node-only code" and "no reference to a
Node global" are different claims and only the first is true.

**Scaffold deleted**, `frontend-react/` removed with `node_modules`, tree
verified clean. Nothing from this item is committed.

---

## 5. The approval endpoint's distinct response shapes

Seeds the Phase 3 fixtures. **Per Verification 47 these must be produced through
`buildApprovalPage` with real inputs, never hand-shaped to what a component
reads** - the round already has two instances of a fixture built to satisfy the
implementation and passing while the system was wrong.

### The nine the brief names

| # | shape | the lib input that produces it |
|---|---|---|
| 1 | **Bridge present** | `baseline` non-null with `inputs`; `moved.bridge = buildBridge(baseline.inputs, payload, …)`, `absence: null` |
| 2 | **Stated absence** | `baseline: null` → `bridge: null` and the sentence *"First approval. No prior approved version. Priced against target N%"*, extended with provenance and cost-basis date when present |
| 3 | **Bridge non-reconciling** | `checkReconciliation` returns `reconciles: false` when `abs(rounding) > tolerance`, tolerance being `(steps + 2) × 0.005` at 2dp |
| 4 | **Unexplained residual** | `buildBridge`'s `unexplained = total − summed` non-zero: a movement no step claims |
| 5 | **Unassigned keys** | `unassignedKeys` = `pricedKeys()` minus every key a step claims; a priced key nothing accounts for |
| 6 | **Missing cost basis, in use** | `catalog.missing` includes a product whose `PRODUCT_UNITS[product](payload) > 0` → `unpricedInUse` non-empty → `unpricedWarning` naming units and product |
| 7 | **Missing cost basis, not in use** | same `catalog.missing`, but units are 0 → `missingDetail[].inUse === false`, the not-affected note, no warning |
| 8 | **Empty `notRecorded`** | `buildNotRecorded` returns `[]`: every applicable key set, no missing products, no captured-not-applied field |
| 9 | **Version absent** | `version: null` → `versionLabel: null` → the page says no version was taken rather than pretending |

### Four more the code can produce that the list misses

Reported because the brief asked for shapes the enumeration misses, and a Phase 3
suite built only from the nine would leave these unrendered and untested.

| shape | produced by |
|---|---|
| **Baseline present but NOT comparable** | `baselineHasCostBasis` false → `comparable: false` → `moved.caveat`: *"…carries no cost basis, so its lines priced at zero. The steps below are not a comparison of two priced deals and must not be read as one."* A distinct third bridge state, neither present-and-fine nor absent |
| **Self-funding deal** | cash exposure computes no negative month → reports no exposure rather than a worst month |
| **Conditional disclosure fires / does not** | `appliesToDeal(key, payload)` true vs false: a disclosure that fires when the field applies and stays silent when it cannot apply to this deal |
| **Absent governing input fails loud** | the governing input for a conditional key is missing → the disclosure fires rather than being skipped, which is the deliberate fail-loud branch |

The bridge therefore has **three** honesty states to preserve, not two: reconciling,
not reconciling, and present-but-not-comparable. Phase 2's twelve-point list
names the first two at point 6; the third is carried by the caveat and should be
verified alongside them.

---

## 6. Node and npm versions, CI and Render, against Vite

**Two findings here, and the second needs a decision before Phase 1.**

| where | Node | npm |
|---|---|---|
| GitHub Actions (`.github/workflows/test.yml:33`) | `node-version: '22'` via `setup-node@v4` | not pinned; whatever ships with that Node |
| `package.json` `engines` | `>=20.6` | not declared |
| this machine | 25.9.0 | 11.12.1 |
| Render | **no configuration in the repository at all** | — |

**Vite 8.2.2 declares `engines: { node: "^20.19.0 || >=22.12.0" }`** - measured
from the installed package during item 4, not recalled.

### Finding 6a: the declared engine floor is below Vite's

`package.json` says `node >=20.6`. Vite 8 requires `^20.19.0 || >=22.12.0`. **A
Node 20.6 through 20.18 environment satisfies this repository's declared floor
and cannot run the build.** Nothing enforces the floor today, so this is latent
rather than breaking - but the declaration is now wrong, and Phase 1 is the
moment it starts to matter.

### Finding 6b: CI's pin is a floating major

`node-version: '22'` resolves to the newest 22.x, which today is above 22.12 and
satisfies Vite. **It is not a guarantee.** The pin expresses "any Node 22", and
Vite 8 rejects 22.0 through 22.11. The gap between what the pin says and what
Vite needs is invisible while the resolver happens to pick a new enough version.

### Render: the question has no subject

There is no `render.yaml`, no `Dockerfile`, no `.node-version` and no `.nvmrc` in
the repository. This is consistent with `CLAUDE.md` build discipline 11's own
recorded resolution: **Render was never set up - no deployment, no auto-deploy,
no environment.** There is no Render Node version to report, and reporting one
would be inventing it. The deployment target remains the item at the head of
package B, gated behind build discipline 13.

---

## Findings summary

| # | finding | severity |
|---|---|---|
| 6a | `engines: node >=20.6` is below Vite 8's `^20.19.0` floor | needs a decision in Phase 1 |
| 6b | CI pins `node-version: '22'`, a floating major that Vite 8 rejects below 22.12 | needs a decision in Phase 1 |
| — | `MIGRATION_ROUND_1_BRIEF.md` is untracked in the working tree | for John: commit it, or it is one `git clean` from gone |

Items 1, 2, 3, 4 and 5 confirmed with no discrepancy against the brief's stated
expectations.

**Phase 0 ends here. Phase 1 does not begin without John's word.**
