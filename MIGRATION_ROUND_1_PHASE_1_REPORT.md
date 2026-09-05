# Migration Round 1, Phase 1: the Vite shell

**Built 2026-09-05.** Seven items from the STEP C instruction, plus the item 6
rulings carried forward from the Phase 0 report. Gate green before reporting.

Phase 2 has not been started. Nothing has been pushed.

---

## 1. What was built

### The workspace

`frontend-react/`, new at the repo root, untracked before this commit.

| package | version resolved |
|---|---|
| `vite` | 8.2.2 |
| `react` / `react-dom` | 19.2.8 |
| `@vitejs/plugin-react` | 6.1.1 |
| `typescript` | 7.0.2 |
| `@tanstack/react-query` | 5.102.8 |

`tsconfig.json` carries `allowJs: true, checkJs: false`, which is the brief's
"`src/lib` remains plain JS and is imported across the boundary untouched".
`npx tsc --noEmit` is clean.

### Stable output filename, and why it is not a hash

Vite's default is content-hashed (`main-CCHBKtfj.js`). **A static `<script src>`
in a hand-written `index.html` cannot know a hash**, so the build is pinned:

```
rollupOptions: { input: 'src/main.tsx', output: {
  entryFileNames: 'terminus-react.js',
  chunkFileNames: 'assets/[name].js',
  assetFileNames: 'assets/[name][extname]',
} }
```

Losing the hash normally costs cache-busting. **It costs nothing here**, because
Round 41 put `cache-control: no-store, must-revalidate` on everything outside
`/api` in response to Verification 42. The header proof below confirms the new
prefix inherits it, so there is no cache to bust.

Build: 61 modules, `dist/terminus-react.js`, **224,968 bytes**.

### The mount

`src/server.js` gains a second `@fastify/static` registration at `/app/`,
`decorateReply: false`, placed immediately before the `onSend` hook.

`frontend/index.html` swaps the script tag. The vanilla file stays in tree,
unloaded, per the brief.

### The shell-services seam

`shell-services.ts` is the only module in the React tree that reads `window.*`.
Components receive it through `ShellContext`; no component reaches for `window`.

### The query layer

`queries.ts` holds the one key scheme, `['opportunity', id, 'approval-page']`.
The `queryFn` throws **the server's own sentence** on `!r.ok` rather than a
generic message, and `ApprovalView` renders `isError` into a visible slot rather
than swallowing it.

---

## 2. The header proof

Measured against the real running server, not reasoned from the hook's source.
Phase 0 item 1 established that `onSend` covers a prefix registered after it;
this confirms it for the prefix that now exists.

```
  /app/terminus-react.js     200  cache-control: no-store, must-revalidate
  /app.js                    200  cache-control: no-store, must-revalidate
  /api/config                200  cache-control: (none)
```

The third row is the counterfactual: the hook's `/api/` exemption is live, so
the first two rows are the hook acting rather than a default that would have
been there anyway.

---

## 3. The re-pointed assertion, before and after

`scripts/tests/commercials-wiring.test.mjs`, the `.ds-row` block.

### BEFORE

```js
  // .ds-row and friends STAY: the approval page renders with them.
  const approval = readCode(new URL('../../frontend/opportunity-approval.js', import.meta.url))
  assert.match(approval, /class="ds-row/, 'the approval page still uses these, so the rules stay')
  assert.match(css, /^\.ds-row \{/m)
```

With the script tag swapped, `frontend/opportunity-approval.js` is a file the
browser never fetches. **The assertion would have gone on passing by reading
it** - green, unchanged, and measuring dead code. This is the first of the 106
and the template for the rest.

### AFTER

```js
  const liveConsumers = [
    '../../frontend/app.js',
    '../../frontend/opportunity-deal.js',
  ].map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(liveConsumers.some((src) => /ds-row/.test(src)),
    'nothing loaded uses .ds-row, so the rule below is dead')
  assert.match(css, /^\.ds-row \{/m)

  // AND THE DEAD FILE IS NOT LOADED, so nobody re-points at it by habit.
  const indexLive = stripHtml(readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8'))
  assert.ok(!/opportunity-approval\.js/.test(indexLive),
    'the vanilla approval view is unloaded; a live script tag would make the dead file live again')
```

### The measurement that changed the shape of it, and a departure named

The instruction was to re-point **at the React source**. I did not, and the
reason is a measurement rather than a convenience.

`.ds-row` uses, comments stripped:

| file | uses | loaded? |
|---|---|---|
| `frontend/app.js` | 5 | yes |
| `frontend/opportunity-deal.js` | 3 | yes |
| `frontend/index.html` | 2 | yes |
| `frontend/opportunity-approval.js` | 1 | **no, as of this commit** |
| `frontend-react/src/*` | **0** | yes |

Two things follow. **The original premise was wrong**: the approval page's single
use was never what kept the rule alive, and eight live uses in two other loaded
files were. And **the React tree has no `ds-row` this phase**, because Phase 1
renders a placeholder and the five blocks are Phase 2 - so pointing the assertion
at the React source today asserts a fact that is false and fails the suite.

The assertion therefore names live consumers, and adds a second clause the
original did not have: that the dead file is **not loaded**. That clause is what
makes it impossible for a future session to quietly re-point back at the dead
file. **It tightens to name `frontend-react/src` in Phase 2**, and the test says
so in a comment at the site.

The instruction's purpose - it cannot pass against dead code - is met. Its
letter is not, and this paragraph is the reason.

---

## 4. Evidence the shell actually mounts

The suite cannot see this: no test loads a browser, and Verification 40 is
explicit that a boundary is not green until the **success path** has been
exercised from outside. A scratch Puppeteer probe, real session, real fixture
opportunity, torn down after:

```json
{
  "registered": "function",
  "mounted": "approval-view",
  "detailLoadedAfterNav": ["opportunity-approval"],
  "wrapperCalibration": "1 -> 2",
  "vanillaApprovalFetched": 0,
  "bundleFetched": 2,
  "notFound": ["http://localhost:3000/favicon.ico"],
  "visibleText": "APPROVAL\n\nThe approval blocks arrive in Phase 2. ..."
}
```

Each line answers a counterfactual rather than merely being present:

- **`registered: "function"`** - `undefined` if the bundle had not loaded or not
  registered.
- **`mounted: "approval-view"`** - the container would stay **empty**, since the
  vanilla view that used to fill it is unloaded and nothing else in the tree can.
  `approval-view` rather than `approval-error` means the query **resolved**: this
  is the success path, not a rendered failure.
- **`detailLoadedAfterNav`** - and the wrapper is calibrated. A zero from an
  instrument never shown reaching one is not a measurement, so the probe calls
  `detailLoaded` itself afterwards and confirms the counter moves 1 to 2.
- **`vanillaApprovalFetched: 0`** - the swap is real at the network, not just in
  the markup.
- **`notFound: favicon.ico`** - **pre-existing**. There is no `frontend/favicon*`
  in the repository and never has been. Named rather than left in the console
  output unexplained.

---

## 5. What surprised

### a. The 401 that looked like a port clash, and my first theory was wrong

The first full gate run failed **14 of 16 stages**, every HTTP probe, each in
about 130ms. I had a server running from the header proof, so I concluded
`EADDRINUSE` and went to kill it.

**The transcript said otherwise**: `ApiError: GET /industries -> 401`. The probe
session had simply expired. Killing the server was the opposite of the fix - the
stages need it running.

Recorded because the failure signature genuinely looks like a port clash
(instant, uniform, every network stage) and the only thing that separated the two
was reading the captured output instead of the summary table. Verification 16
earning its keep: the run was written to a file, so the real cause was one
`sed -n` away.

The recovery path itself worked, and needed `--env-file=.env`:
`node --env-file=.env scripts/refresh-session.js`.

### b. `window.api` is never assigned anywhere

While writing the seam I grepped for the assignment and found none. My first
grep was anchored to line start and returned 0, which I nearly reported as an
absence - unanchored, it is still zero.

`api` is an **implicit global from a classic script**: `frontend/app.js` declares
it at top level with `function`/`const` in non-module scope, so it lands on
`window` without anyone writing `window.api =`. The seam works today and would
break silently the moment `app.js` becomes a module.

Recorded in `shell-services.ts` at the site. **It is latent coupling, not a
defect**, and it is exactly the kind of thing the seam exists to contain: one
file to change rather than every component.

### c. A missing bundle fails silently, and my own change created that

Measured before writing anything: with `frontend-react/dist` moved aside, the
server **starts cleanly, serves `/` at 200, and answers 404 for the bundle**. The
approval view then renders nothing at all, with no error anywhere, because the
vanilla view that used to fill that container is unloaded.

A blank screen and a working screen are told apart by nobody, and a walk is this
project's stopping condition.

This is Phase 1's own doing, so it is fixed here rather than listed - build
discipline 10's limit, a defect the change created is part of the change.
`src/server.js` now logs an error naming the file and the command. **Calibrated
both directions**: fired with `dist` moved aside, silent with it restored.

`npm run build:react` added to `package.json` so the message names a command that
exists.

### d. `dist` is committed, and that is a Verification 20 second reader

The bundle is committed rather than ignored, so a clean checkout runs. The guard
in (c) covers the bundle being **absent**.

**It does not cover the bundle being STALE**, and that is a genuine second reader
of the React source: committed `dist` and `frontend-react/src` agree today and
will drift the first time somebody edits a component and forgets to build.
Nothing in the gate would notice.

**Named, not fixed, and proposed for Phase 3**: a stage that rebuilds and fails
on any diff. That needs the React toolchain installed in CI, which is Phase 3's
business rather than this phase's.

### e. The new block landed INSIDE another block's comment, and only the diff showed it

The `/app/` registration was inserted immediately before `fastify.addHook`,
which is where it belongs. It was also, by exactly that placement, dropped
**between the `onSend` hook's explanatory comment and the hook itself** - so a
thirteen-line comment about why the header is applied as a hook now introduced a
static mount, and the hook it describes sat thirty lines further down.

**Nothing could fail on this.** `node --check` passes, the suite passes, the
header proof passes, the server behaves identically. It is not a bug; it is a
comment that has stopped pointing at its code, which is Verification 33's
comment-swallowing family in its harmless form - and the harmless form is how
you get the harmful one, because the next person to move that block moves a
comment that no longer says what it is above.

**Found by reading `git diff --cached` before committing rather than by any
check**, which is the honest account: I had already run the gate green over it.
The block now sits above the hook's comment, and the header proof was re-taken
afterwards rather than assumed to survive the move.

### f. Two small things the suite caught rather than me

`stripHtml` needed adding to the test's existing `strip-comments.mjs` import, and
the first version of the new block declared `const html` where the enclosing test
already had one. Both were syntax errors the moment the file ran, which is the
cheap end of the failure spectrum and worth nothing except as a note that the
block was run, not eyeballed.

---

## 6. Item 6 rulings, applied

Carried from the Phase 0 report and ruled in STEP A.

- `package.json` engines: `"node": "^20.19.0 || >=22.12.0"`, which is Vite 8's
  own floor. The previous `>=20.6` sat **below** it.
- `.github/workflows/test.yml:33`: `node-version: '>=22.12 <23'`, replacing a
  floating `'22'`.
- Render stays a deployment-time check, not a repository one. There is no
  deployment today.

---

## 7. Gate

```
MERGE GATE  16 stages
  PASS  pure suite       437/437 pass, 0 fail
  PASS  database suite    92/92 pass, 0 fail
  PASS  14 HTTP probes
All 16 stages passed.
```

---

## Standing at the close

Not pushed. Phase 2 not started. `frontend/opportunity-approval.js` is in tree
and unloaded, and the Phase 5 revert is one uncommented line plus one removed
line, as the brief requires.
