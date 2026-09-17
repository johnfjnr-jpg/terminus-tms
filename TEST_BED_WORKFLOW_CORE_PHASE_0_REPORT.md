# TEST BED WORKFLOW CORE: Phase 0 report

Live reproduction of P0.1 to P0.6. Read-only against the product: no file
under `src/`, `frontend/`, `frontend-react/` or `scripts/` was changed. The
only writes were a tagged fixture built through the API and soft-deleted by
tag, and three refused POSTs bracketed by database fingerprints.

## Verdict first

**All six claims reproduce. None fails to reproduce, so the stop condition
does not fire. Two reproduce DIFFERENTLY from the audit's description, and
those are findings for John before the phases that fix them:**

- **P0.5 (B6): the buyer row does not open at all.** The audit says selecting
  a buyer "produces a dirty row whose Save sends nothing". Live, the row
  refuses to open on mouse click and on keyboard Enter, so nothing can be
  selected, nothing becomes dirty, the edit bar never appears, and the Save
  half of the claim is unreachable. The conclusion (no write path) stands;
  the mechanism is different and it changes what Phase 3.1 is fixing.
- **P0.1 (B1): the UI sends `{"entries":[]}`, not an entry.** Because B2
  leaves the scoring card with no criteria, Record scores posts an empty
  batch. The 400 reproduces. The audit's body shape with a real entry is
  unreachable from the screen and was measured by sending the host's own
  construction through the route.

## The stopped session and the move

A prior sandboxed session started this Phase 0 and stopped on two
environment blockers it measured: no credentials, and a container network
policy denying Supabase at CONNECT (calibrated as a 403). Its stop report was
committed as `568d267` inside that sandbox, is stranded there, and will not
be recovered; this report does not reproduce its content. The work moved to
the local checkout, where `.env`, the session and the dev server live, and
Phase 0 was run again from the start here.

## Environment, established before any claim

| Question | Answer | Instrument |
|---|---|---|
| HEAD | `6da809e`, as required | `git log --oneline -1` |
| Round branch | `round-a` already existed at `6da809e`; checked out, no tree change | `git log --oneline -3 round-a` |
| Server on :3000 is current | PID 31978, `node --env-file=.env src/server.js` (no `--watch`), started 2026-09-16 13:15:12 +0800. Last commit touching `src/` is `3ebeedc` at 2026-09-16 11:39:52 +0800, and `git diff HEAD -- src frontend frontend-react` is empty. So the server post-dates every server source change. A second process, PID 8745 with `--watch`, is not listening. | `lsof`, `ps -o lstart`, `git log -1 -- src/` |
| Session | `PASS session is live for john+test@terminustechnologies.io, and :3000 is answering` | `scripts/check-session.mjs` |
| Bundle | `bundle freshness: PASS`, emitted by each probe run | `scripts/check-dist-fresh.mjs` (rebuild and diff) |
| Stale browser | Each run launches a fresh headless browser; the server sends `no-store` | new browser per run |

**AN ENVIRONMENT FINDING, and it cost the first browser runs.** The cached
Chrome for Testing `153.0.8010.36` (downloaded 2026-09-16 12:19) refuses
`http://localhost:3000/` and `http://127.0.0.1:3000/` with
`net::ERR_ADDRESS_INVALID` in 63 to 77ms, while loading `https://example.com/`
with 200. It fails the same with the command sandbox disabled, with
`--no-proxy-server`, with `--no-sandbox`, and with
`--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks`. The
cached `152.0.7977.75` loads localhost with 200 in 249ms. Every browser run
below used `PUPPETEER_EXECUTABLE_PATH` pointing at 152. **No repository file
was changed for this.** The gate's own browser stages will meet the same
refusal when they resolve the default build; that is recorded here and not
investigated further, per Rule 10. The browser also needed the command
sandbox disabled to run at all in this session.

**The pre-commit hook.** Its hardcoded ROOT is this machine. Its suite script
was run directly before committing and emitted `PASS pure 4.1s`, `PASS react
13.2s`, `PASS database 116.5s`, exit 0, in 2:13.93. Those durations are the
stages' normal scale, not the 0.0s refusal Verification 48 warns about. The
commit then went through the hook itself, without `--no-verify`.

## Method

- **Subject.** No live Test Bed is owned by the probe identity (census: 10
  live, 0 owned), so an owner-side click on real data would have measured the
  door, not the claims. Each run built a fixture the way the system builds
  one: `freshTestBed(tag)` (its own Account, then `POST /test-beds`), plus a
  Contact via `POST /contacts` and `POST /contacts/:id/link-account` to the
  fixture Account. Measured: bed status `Qualification`, owned by the probe
  identity, contact parent equals the account.
- **Every write attempt is bracketed** by a fingerprint read from the
  database: latest revision, status, `updated_at`, audit row count,
  `record_contacts` count, and any `score*`/`measurab*` payload key
  (Verification 40: a 2xx or 4xx is not the evidence, the fingerprint is).
- **Network** is captured by a page-level listener over every `/api/`
  request, with method, body, status and response text.
- **Waits** are on real state: the exit panel carrying
  `data-stage="Qualification"`, the scoring card carrying the same stage and
  not hidden, the request finishing, then two animation frames before any
  DOM read (Verification 6's "one interaction, then yield, then assert").
- **Captured, not filtered.** Every run went to a file under
  `.verify/tb-core-p0/` and was read whole. The evidence below is quoted from
  `run8.txt`, the final full run. `run7.txt` carries identical P0.1 to P0.5
  readings on a different fixture.
- **Teardown** by tag through `tearDown`, then re-queried by id.

## P0.1 (B1): record a score

```
UI click Record scores -> POST /api/test-beds/<bed>/scores
  request body: {"entries":[]}
  response: 400 {"error":"criterion is not a recognised scoring criterion"}
  on-screen messages after: ["criterion is not a recognised scoring criterion"]
  fingerprint unchanged=true
host's own body shape for a real criterion, sent through the route:
  {"entries":[{"criterion_key":"scoreRolloutPath","score":1,"reason":null}]}
  result: 400 {"error":"criterion is not a recognised scoring criterion"}  fingerprint unchanged=true
```

**Reproduces, differently.** The only scoring control the screen offers is
Record scores, because the card has no criteria (P0.2), so the UI posts an
empty batch. The second line is the audit's exact seam: the host's
construction at `TestBedHost.tsx:533-539` for a real criterion, refused with
the same message, because `score-entry.js:62` reads a flat `criterion` and
the body carries `entries[].criterion_key`.

**The refusal's reason is asserted, not only its status** (Verification 14's
wrong-reason clause): the message names the criterion lookup, which is the
contract mismatch, and not ownership or validation of the score.

**Not established here:** that the flat body `{ criterion, score, reason }`
is accepted. That is a write, and it is Phase 2's calibration ("the real
client body driven into the real route, shown accepted").

## P0.2 (B2): the scoring card is empty

```
GET /api/scoring-criteria?record_type=test_bed -> 200; 5 criteria:
  scoreRolloutPath,scoreClientCommitment,scoreUseCaseRequirementsAndMetrics,scorePhysicalSuitability,scoreDataRights
gate names scored criteria at Qualification: 5 (requirements with a score* field)
card: hidden=false display=block height=84 criteria selects=0 record buttons (calibration, same scope)=1
card text: "SCORING\nRecord scores"
```

**Reproduces as described.** Visibility is asserted by computed `display`
and rendered height, not by the attribute (Verification 4). The count of
zero is calibrated on the same scope: the same query root finds the one
Record scores button, so the scope reaches the card's content.
Screenshot: `tbcore-p0-qualification-1920.png`, opened and read: the card
shows the title and the button, nothing else.

**Not measured:** B2's second half, history counts reading 0 on an already
scored record. The fixture has no scores, and scoring one is a write.

## P0.3 (B3): the exit criteria panel reads empty

```
GET /api/records/<bed>/exit-criteria?stage=Qualification -> 200; Array.isArray(body)=false;
  keys=from_stage,to_stage,blocking,requirements
to_stage=Pre-Site Assessment requirements=14 blocking=14
  types=contact_role_linked,payload_field_required,approval_obtained
panel text: "No exit criteria for this stage." rows=0 checkboxes=0 rendered=true
```

**Reproduces as described.** The response is an object carrying 14
requirements; the panel, settled for Qualification, shows its empty branch.
The same screenshot shows "No exit criteria for this stage."

**Counterfactual for the wait** (Verification 7): the panel only carries
`data-stage` once settled, and before that it reads "Loading ...". The text
read is therefore the settled branch and not the pending one.

## P0.4 (B5): a blocked transition renders nothing

```
Next Stage button: {"disabled":false,"label":"Next Stage"}; exit-criteria blocking before click = 14
POST /api/records/<bed>/transition body={"to_stage":"Pre-Site Assessment"} -> 422; blocking items=14
DOM: getElementById('tb-next-stage-feedback') present=false; testid element innerHTML="";
  .blocking-list count=0; "Transition blocked" on screen=false
fingerprint unchanged=true (status Qualification)
CALIBRATION (id added in the live DOM only): POST -> 422; feedback "Transition blocked"=true;
  list items=14 vs blocking=14; fingerprint unchanged=true
```

**Reproduces as described**, and the calibration proves the cause as well as
the instrument. Adding the id to the rendered element in the browser, with
no file changed, makes the shell's `attemptTransition` render
"Transition blocked." and all 14 items, read through the same wait and the
same DOM query. So the empty reading was not a read taken too early, and the
missing id is sufficient to explain it. Screenshots:
`tbcore-p0-blocked-transition-1920.png` (nothing under the tab row) and
`tbcore-p0-blocked-transition-calibrated-1920.png` (the itemised list), both
opened and read.

The precondition was checked before clicking, because a click with nothing
blocking would have transitioned the record: the button enabled, and 14
blocking items on the exit-criteria response.

## P0.5 (B6): selecting a buyer contact

```
before click: {"displayHidden":false,"editHidden":true,"options":["--","TBCORE-P0-... Contact"],
  "pointHitsDisplay":true,"canEditFields":true,"rowDirty":"false",
  "bar":{"hiddenAttr":true,"display":"none","count":"0 changes"}}
after MOUSE click on the buyer row: (identical)
after KEYBOARD Enter on the focused buyer row: (identical)
non-GET requests during both attempts: 0 []
CALIBRATION registered row "initialLead" (same card, same click): before editHidden=true after editHidden=false editVisible=true
calibration row after Escape: editHidden=true bar={"hiddenAttr":true,"display":"none","count":"0 changes"}
record_contacts links before=0 after=0; fingerprint unchanged=true
buyer-contacts calls across the whole run: 0
network instrument calibration (same listener, same page): writes it captured earlier this run =
  POST .../scores 400; POST .../transition 422; POST .../transition 422
```

**Reproduces DIFFERENTLY. This is the finding for Phase 3.**

- The row cannot be opened. `elementFromPoint` lands on the display half,
  the door answers `canEditFields() === true`, the fixture's contact IS in
  the rendered options, and the editor stays hidden on both mouse and
  keyboard.
- **The mechanism, read after the measurement:** the three buyer rows are
  rendered through `FieldRow` with the host's `rows` store
  (`TestBedPanel.tsx:208-213`), but `testBedDescriptors` deliberately omits
  them (`descriptors.ts:12`, "-3 buyer-<role> lookups"). `requestOpen` returns
  false for a name the store does not hold (`useFieldRows.ts:101-102`), and
  `setDraft` refuses the same way (`useFieldRows.ts:136`). So the row renders,
  offers itself as a tab stop, and can never open or draft.
- **So the edit bar cannot show a buyer change at all.** The audit's "a dirty
  row whose Save sends nothing" is not reachable, and `buildPayload`'s
  `buyer-` skip (`TestBedHost.tsx:97`) is never exercised by a real draft.
- **What does reproduce:** no write path. Zero `buyer-contacts` calls, zero
  non-GET requests, zero new `record_contacts` rows.
- **Calibrated both directions.** The same click opens a registered row on
  the same card (`initialLead`), so the click method and the open-state read
  are sound. The network listener captured the three POSTs earlier on the
  same page, so a write here would have been seen. Screenshot
  `tbcore-p0-buyer-refused-1920.png`, opened and read: Client Lead open, the
  buyer rows showing their placeholder.

**Why it matters to the brief.** Phase 3.1 says the buyer rows should "leave
the batched dirty accounting entirely, so the edit bar can no longer show a
change that saves nothing". Measured, they are already outside it; the
live defect is a rendered, focusable row that refuses to open. Phase 3 is
still the right fix (a direct-write control). **Its acceptance sentence
describes a state that does not exist today**, so a test written against it
would pass on the current code. Raised here for John rather than resolved.

## P0.6 (L1): no control reaches the measurability route

```
Qualification gate requirement naming measurabilityConfirmed: 1
  [{"type":"payload_field_required","met":false,"label":"Sensors can capture what would be measured"}]
sweep qualification                            controls=27 measurability=0 | calibration recordScores=1
sweep reference                                controls=61 measurability=0 | calibration recordScores=0
sweep sub:tb-ref-subtabs-btn-useCases          controls=61 measurability=0
sweep sub:tb-ref-subtabs-btn-customerDocuments controls=62 measurability=0
sweep sub:tb-ref-subtabs-btn-history           controls=59 measurability=0
sweep commercials                              controls=44 measurability=0
sweep qualificationAgain                       controls=27 measurability=0 | calibration recordScores=1
requests to /measurability across the whole run: 0; total /api requests captured: 33; POSTs captured: 3
```

**Reproduces as described.** The gate requires `measurabilityConfirmed`, and
across Reference, its three sub-tabs, Commercials and Qualification (twice)
no control matches `measurab` or the requirement's own label, and no request
reached the route.

- **The sweep matches** a control's text, aria-label, testid, name, id,
  enclosing label, nearest testid ancestor and parent text. It is calibrated
  on the same population: `record scores` is found exactly once on
  Qualification and zero times elsewhere, which is where that button lives.
- **One text mention per tab was located, not assumed**: it is
  `LI[tb-next-stage-feedback] Requires Sensors can capture what would be
  measured`, the blocking list **my own P0.4 calibration injected**. It is a
  list item, not a control, and not product markup.
- **The network absence is calibrated** by the same listener capturing the
  three POSTs in the same run.
- **The server log was not read.** The server's stdout is not attached to
  any file this session can see. The brief offers the log or network absence;
  network absence is what this rests on.

## Calibration summary

| Check | Fires on | Silent on |
|---|---|---|
| Scoring-card criteria count | same scope finds Record scores = 1 | criteria selects = 0 |
| Exit panel settled read | `data-stage` present only once settled | "Loading" branch excluded |
| Blocked feedback read | id injected in the DOM: 14 of 14 items | real element: empty |
| Row open-state read | registered row opens | buyer row stays closed |
| Network write listener | 3 POSTs captured | 0 during buyer attempts; 0 to `/measurability` |
| Control sweep | `record scores` = 1 on Qualification | `measurab` = 0 everywhere |
| Fingerprint | (not shown moving; every attempt here was refused) | unchanged across every attempt (2 score POSTs, 2 transition POSTs, 2 buyer-row attempts) |

**The fingerprint was never shown moving in this phase**, because every
attempt was refused and no deliberate write was made. It reads six columns
directly from the database and is quoted as corroboration of the refusals'
status codes, not as a calibrated detector. Phase 2's accepted-score
calibration is the first place it can be shown moving.

## Probe faults, self-caught, none reaching a reading

1. **`/api/api/industries` 404.** `api-client.mjs` prefixes `/api`. The run
   died after `freshTestBed` had created its Account and Test Bed and before
   any teardown was in scope, so those two were torn down by tag at once and
   the probe was restructured so a crash always tears down.
2. **The client returns `{ status, ok, data }`**, and the contact's id was
   read off the wrapper.
3. **Chrome 153 refused localhost** (above).
4. **`innerText` applies `text-transform`**, so "1 change" never matched
   (the card read "SCORING"). Replaced with `textContent`.
5. **A wait for the buyer editor to open timed out.** Diagnosed by
   `elementFromPoint`, then the door, then bisecting through every earlier
   step (door true throughout, row refusing even fresh), which is what
   turned a probe fault into the P0.5 finding.

## Residue

```
records created by the probe identity since 2026-09-17T00:30:00Z: 26
LIVE: 0
```

Ten tags (eight probe runs and two diagnostics), each an Account and a Test Bed,
and a Contact on the six runs that reached it (10 + 10 + 6 = 26). All soft-deleted by tag and
confirmed by re-query. No `reference_number_counters` row was touched. No
unit was derived, because the Installation tab was never opened.

## Notes carried to later phases, not acted on

- **Phase 4.1 (B5).** Once the id returns, the shell writes the blocking list
  by `innerHTML` into an element React does not own. Measured in the
  calibrated run, that list stayed on screen after switching to Reference,
  Commercials and every sub-tab, because the tab-change clear (T6) only clears
  React's own `feedback` state. That persistence will be created by the fix,
  so it is part of Phase 4 under Rule 10's authorship limit.
- **Phase 3.1** acceptance wording (see P0.5).
- **The gate's browser stages and Chrome 153** (environment, above).

## Where the evidence lives

`.verify/tb-core-p0/`: `probe-p0.mjs`, `run1.txt` to `run8.txt`,
`network.json`, `results.json`, the six screenshots, `subjects.txt`,
`residue.txt`, the reachability runs and both door diagnostics.
**`.verify/` is gitignored and `scripts/` is not ruled into this round, so the
probe source is NOT committed.** If it should be kept, it needs a home named
by John.

## What this report does not establish

- That any fix works. Nothing was fixed.
- That the flat score body is accepted (Phase 2's calibration).
- B2's history count on a scored record (not measured: it needs a write).
- Anything at 1240 or 3440. These are behaviour claims, not layout claims,
  and every capture is 1920.
- The server log.
