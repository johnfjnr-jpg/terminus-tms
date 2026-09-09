# The UI hygiene round (v2): close-out

Tree `fce0583`, clean. **Gate: all 22 stages passed.** Nothing pushed.

## 1. The exit gate, answered point by point

| question | evidence |
|---|---|
| Gate green on the exact committed tree | **22/22**, `MERGE GATE main fce0583`, no `WORKING TREE DIRTY`. Tree hash `5931b582…` unchanged during the run |
| The door stage GREEN, not skipped (R15) | `PASS HTTP readonly-view probe exit 0 55758ms`, browser present |
| Pure / database / react | 502/502, 98/98, 915/915 |
| Token file never committed | `git log --all --diff-filter=A -- session-ref-approver.json` **empty**; 0 objects by that name; same for `session-ref.json`. Now gitignored |
| `CURRENT_STATE.md` regenerated | at `5111cb7` on a clean tree |
| Staleness check | recorded SHA is an ancestor of HEAD, **0** tracked config sources changed since: **NOT STALE** |
| Revert rehearsed | from explicit ref `3ee418d`, tree `5931b582…` **byte-identical** before and after, verified by `git write-tree` |
| Residue | **0** probe records. 132 live = 126 business + 6 walk65 |
| Commits reconciled | 32 round commits, every one mapped below |

## 2. What the round did

**The door was measured, not argued.** Phase 0 censused by four unioned
instruments rather than a selector list, because the parked round's own finding
was that the ring-radio "appears in no door selector".

    reachable write controls on an unowned record
      Phase 0 census      65        of which mouse 19, keyboard 46
      after P2.1           0        mouse 0, keyboard 0
      owned record        71        unchanged - the door does not over-reach
      approver decisions  2/2       preserved

**One cause, not the four it looked like.** `applyReadOnlyControls` was a
one-shot sweep inside a render, and the surface grows after it: 144 controls at
+3540ms, 296 at +4045ms. Of the 152 that arrive late, **116 are vanilla and 36
React** - calling it a React problem would have fixed a third of it.

**The treatment targets the operating surface.** A disabled input closes two
gaps at once: a label does not activate it, and it leaves the tab order. Widgets
that are not control elements are found by what they ARE. `.btn-text` was
narrowed from a styling class to the shapes it was written for.

**Server-side, 5/5 both ways, 5/5 refused on identity**, including the two
role-scoped routes where "non-owner rejected" would have reported a working
control as a gap: the seated approver lands and the record owner - the
requester - is refused on their own request.

**Delivered:** R2c's Reference column, R2d's eight help-dots, the door fix,
R9's gate stage, R8's probe repairs, the tag-scoped teardown, the handed-away
sweep, the duplicate tripwire, eight rulebook promotions.

## 3. Commits, reconciled against instructions by counting

32 commits. Grouped by the instruction each answers.

| instruction | commits |
|---|---|
| R1a tearDown by tag | `7c52439`, `543f5d2` |
| R1b Verification 8 extension | `1269f1f` |
| Phase 0 census | `5004ba4` |
| Brief amendment R5-R8 | `8201570`, `13868f0` |
| R8 probe repairs | `b78f833` |
| R9/R10 recorded, R10 completed | `7d7b143`, `3b737a5` |
| Phase 1 door fix and reports | `31292dd`, `495cf1a`, `d0cf07f`, `2c99c67` |
| Ruling 3 sweep | `7d5e7a9` |
| P2.0 enumeration | `a9061e4` |
| P2.1 defects and verification | `646409a`, `bbf32b1` |
| R11/R14 promotion queue | `565ff31`, `47dbb8f` |
| P2.2 R2c, help, R2d, tripwire, R2b carried | `3a181a1`, `fcb6950`, `1fa5e12`, `4e1812a`, `721d284` |
| P2.3 server proofs | `28f9aa2` |
| P2.4 R9 enumeration and gate stage | `e301630`, `54f604b`, `cbff035` |
| P2.5 handed-away sweep | `b5268aa` |
| P2.6 promotions and state | `7e1bd00`, `5111cb7`, `fce0583` |

**Named departures**, each recorded at the time rather than found at the close:
the act-1 `git add -A` (accepted, R7, history not rewritten); two promotions
misplaced by section and fixed forward; R2b carried on a measured false premise.

## 4. Eight promotions, each extending an existing rule

Rule 32 holds: **81 rules, nothing renumbered**. Verified by walking back from
each extension to its owning rule AND the section heading above it.

| rule | extension | why not a new number |
|---|---|---|
| 14 | an alarm firing for the WRONG REASON | 14 is a check passing with nothing on either side; this is one firing on the wrong cause |
| 16 | the READING of a run is an instrument | 16 says capture the output; this says the search over it can be wrong |
| 19 | a name used as an ENUMERATION | 19 is a name asserting a property; this fails by silent omission |
| 20 | two instruments disagreeing about CLASSIFICATION | 20 is two readers of a value; this is two readers of a definition |
| 33 | a measure that MOVES THE WRONG WAY | 33 is a measure that cannot see; this one sees and reports an improvement |
| 40 | a 2xx IS NOT A WRITE | 40 says assert behaviour not status; this says status cannot show a write happened |
| 41 | a retired SURFACE absorbs an edit | 41 is a retired route that still works |
| 44 | confirm the edit LANDED before measuring | 44 compares bytes after a restore; this is the same hole facing the other way |

## 5. What surprised

**Rule 44 failed on its first outing, in the commit that promoted it.** Two
extensions landed under Build discipline 14 and 16 instead of Verification,
because rule numbers repeat across the three sections and I anchored on the
number. I *had* asserted the artefact changed - count held at 81, diff 156
lines, no em dashes - and **none of those checks could see a block under the
wrong rule.** Every number was right and the text was in the wrong place: rule
33's shape arriving inside the commit that promoted rule 33.

**I raised the R10 stop clause and it was wrong.** `restore` answers 200 and
writes nothing. Retracted with evidence within the hour; the fingerprint rule
is the fix and is now promoted into rule 40.

**The container kill flattered my own headline.** "mouse reachable: 0" was
partly a blanket panel kill, not controls being treated. Four detectors were
needed before one moved the right way.

**Three nominal rules failed in one round** - `.btn-text`, `.help-dot`, a named
duplicate list - which is what turned enumeration-by-name from a lesson into a
promotion.

## 6. Carried items

| item | state |
|---|---|
| **R2b, the stat strip** | **Premise measured FALSE.** There is no React strip: `#ref-root` renders, the React Reference panel has zero `stat-` occurrences, all three `.stats-grid` are invisible, and `detail-testbed-cost` sits in `#ref-vanilla` at `display:none`. Not "add a cell" but "build a strip" - a new surface needing design input on cells, data and placement. **Its own round.** The dead write at `app.js:7447` is confirmed dead because the whole strip is |
| **The vanilla retirement class** | `#deal-form-vanilla`, `#deal-version-vanilla`, `#ref-vanilla` - three retired duplicates, **one job**, one scoped round. Until then the tripwire fails on any edit to them and on an unrecorded fourth |
| **19 routes unexercised as a non-owner** | 21 of 40 covered; P2.3 added the delta's five |
| **Concurrency** | untested on every path proved this round |
| **The `complete-document` coverage disagreement** | recorded, not resolved |
| **`probe-readonly-view` runs 56s in the gate** | the gate is now ~7 minutes. Noted, not a finding |

## 7. What this close does NOT cover

- The 19 unexercised routes, and anything about them.
- Concurrency on any proved path.
- The three duplicates remain in the served HTML; only edits to them are caught.
- R2b is unbuilt by measurement, not by omission.
- Nothing is pushed. `origin/main` is `890da4f`; **33 commits** are unpushed -
  this round's 32 plus `3ee418d`, the previous round's R8 commit.
