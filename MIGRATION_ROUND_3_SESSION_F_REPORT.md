# Migration Round 3, Session F: the swap

**Items 1, 2 and 3 landed. Items 4 to 7 did not run and are carried, listed in
section 8.** Gate green at 21 stages. Not pushed.

**The React panel is the live Commercials surface.**

---

## 1. The swap

| what changed | where |
|---|---|
| the bundle registers `initOpportunityDealPanel` | `frontend-react/src/main.tsx` |
| the form's script tag removed, commented in place | `frontend/index.html` |
| the vanilla markup wrapped in `#deal-form-vanilla` and **hidden, not deleted** | `frontend/index.html` |
| the mount container `#deal-form-root` added | `frontend/index.html` |

`app.js` calls `window.initOpportunityDealPanel?.(opp)` during the record load,
exactly as it called the vanilla's. Nothing else about the shell moved: the tab
mechanics, the freeze banner, `oppPatch`, the revision handshake and
`openDiscardConfirm` all stay where they are, and the version machinery is
handed the React seam through the same `initOpportunityDealVersions` call.

### THE REVERT PROCEDURE

**One line, and nothing else has to be undone.**

1. In `frontend/index.html`, uncomment
   `<script type="module" src="/opportunity-deal.js"></script>`.
   It sits in a comment block that says this, at the tag's own position.
2. Reload. Nothing else.

**Why that is sufficient, and what wins.** `index.html` loads the React bundle
first and `opportunity-deal.js` after it, so the vanilla's
`window.initOpportunityDealPanel = ...` assignment **runs last and wins**. The
React mount is then never called, so it never hides `#deal-form-vanilla`, and
the static markup - which was never deleted - renders as it always did.

`opportunity-deal-versions.js` is untouched by the revert. It is live under
**both** forms and is handed its seam by whichever panel mounts, which is what
the D2b seam ruling was for.

**What guarantees the revert stays one line:** `shell.test.tsx` asserts the
bundle's ENTIRE global surface after import - now
`['initOpportunityDealPanel', 'loadAccountDetail', 'loadApprovalPage']`. A
fourth global would fail there, and a fourth global is what would make the
revert more than a script tag.

**What guarantees the revert target stays intact:** `class-rules.test.mjs` walks
the hidden markup's structure - the five sections as siblings, no comment
swallowing a tag. That markup is no longer the live screen, so a defect in it
would surface on the day somebody needed it and not before.

---

## 2. The version workflow against the REACT form: **28 of 28**

Real server, real fixture, signed in, **teardown in a `finally`**.

The seam is provided, the five form-facing members named individually · the
version file registered its init · both outward feeds live · the list renders ·
the reason box reachable · a version taken from a **clean** form writes no deal
revision · a version from a **dirty** form writes one **first**, and the version
freezes the SAVED value · the form reads clean after the freeze · the latest
draft issues · a restore onto a clean form loads the version it targeted · a
restore over a **dirty** form raises the discard prompt · **a refused save takes
no version, and the card says the pricing could not be saved**, with the save
proven to have been attempted.

**It passed 23/24 on the first run.** The one failure was the probe asserting
the seam's key set was **exactly five**, which was true of the vanilla adapter
and is not the ruled interface: D2b ruled five members **plus the two outward
feeds**, and the React seam implements all seven. The exact-set claim belongs to
the interface, where `deal-seam.test.ts` asserts it; the probe now names the
five members the version machinery calls, individually.

---

## 3. `is-scrollable`: verified in a browser, both directions. **6 of 6**

The last name on the adoption ratchet, and one jsdom cannot measure at all.

| state | scrollWidth | clientWidth | class |
|---|---|---|---|
| 60-month grid at 1240px | 5260 | 874 | **present** |
| 3-month grid at 1240px | 874 | 874 | **absent** |

Both directions, because "present" alone would pass on a render that applied it
unconditionally. Each is asserted twice - the class, and that the grid really
does overflow or really does fit - so an absence cannot be a broken observer
reading as a clean result.

**The ratchet is closed.** `KNOWN_MISSING_CLASSES` is empty.
`is-scrollable` is recorded separately as **not observable in jsdom**, with this
measurement named beside it, rather than being deleted from the list.

`scripts/probe-scrollable.mjs` is committed.

---

## 4. The coupling ledger, made enforceable

**`frontend/opportunity-deal.js` is still on disk, and that is the hazard.** A
test reading it goes on passing while asserting nothing about the screen anybody
uses - the exact shape Round 2 hit when `account-detail.js` was unloaded and its
assertions kept reading it.

`scripts/tests/vanilla-coupling.test.mjs` enumerates the **24 blocks** that
still do, and asserts the set **both ways**: no new coupling may appear, and no
entry may rot into a record of work already done. Calibrated: an invented block
that reads the superseded file fires it.

`strip-comments.test.mjs` is exempted by name - it reads the file as a **corpus**,
for its bytes rather than for a claim about the screen.

---

## 5. Re-points landed, with the distinction carried

| block | class | disposition |
|---|---|---|
| `FINDING 5: the note says what the code does` | source-shape | **re-pointed twice.** D2c split it across the vanilla adapter and the version file; the swap superseded that adapter, so the form half now reads `seam.ts`. Left alone it would have asserted the save order of an implementation the browser never loads |
| `no comment swallows a tag, and the five sections are siblings` | source-shape | **re-pointed** to `#deal-form-vanilla`. Its value went UP: it now guards the revert target |
| `the bundle does NOT register initOpportunityDealPanel` | behaviour | **claim changed by adoption.** It asserted the panel was behind the line, which the swap is the moment of ending. Superseded reasoning kept |
| `the loaders are registered after import, and NOTHING else is added` | behaviour | **updated by adoption.** Same claim, one more global, and it is the revert's foundation |
| the factoring switch wording, the shared catalog fixture (E runs) | behaviour | **claim changed by adoption**, recorded in the E reports: the React helper had drifted from the vanilla's own strings, and the fixture had been shaped to the implementation |

---

## 6. Two findings from the swap itself

**`populate` could not restore most of a version.** The seam's `populateForm`
was an inline loop over CENSUS ids keyed by `id.replace(/^deal-/, '')`. It
restored neither the milestone rows, the contractor rows, the margin overrides
nor the UI state, and it **mis-keyed `deal-lumpCost`**, whose payload key is
`lumpSumCost`. A restore that quietly leaves the schedule behind is the version
machinery's whole point undone. It now goes through `valuesFromPayload` /
`uiFromPayload`, written from the vanilla's `populateForm` line by line, and the
mount uses the same readers.

**A test was shaped to that defect.** `restoring the SAME values leaves it
clean` passed `{ gstPct: 9 }` - a partial payload that only worked because
populate MERGED. No caller sends one: `restoreVersion` posts the version's whole
`inputs`. It now restores the form's own current payload.

---

## 7. One instruction could not be resolved

**"entry-5-shape strings checked".** `entry 5`, `entry-5` and `entry5` appear
nowhere in the repository - not in the briefs, the reports, the tests or the
source. I could not establish what it names, so I have not claimed to have done
it.

**What I ran instead**, as the nearest thing the phrase plausibly asks for and
worth running regardless: Architecture 9's fourth variant, a scan for **strings
describing the superseded arrangement**. It found one real instance -
`DealPanel.tsx`'s header still said the panel was behind the line, the bundle
registered nothing and the vanilla was untouched and live. All three clauses had
become false. Corrected, with the old note kept because it records the method.

---

## 8. Items 4 to 7: NOT RUN, carried

| item | status |
|---|---|
| 4. the 38 behavioural blocks against the React panel | **not run** |
| 5. visual comparison at three widths on exercised states | **not run** |
| 6. remaining render-level injections | **not run.** The injections this session's own work needed were run and fired |
| 7. the completed ledger by class | **partly.** Section 5 carries the blocks re-pointed by the swap with the update-versus-re-point distinction; the full by-class ledger is not compiled |

The 24-entry coupling list in section 4 is the precise, enforced work list for
item 7, and it is the same set item 4 will re-point.
