# Round 17 build brief: unit records, per-unit sub-tabs, count lock

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND16_BUILD_BRIEF.md`. Read all six before starting.

**Round 16 did not edit `CLAUDE.md`.** Round 15 edited it three times.
Re-read from disk anyway and say whether the copy you hold is current,
rather than assuming either way.

This round builds the first records in the system that represent physical
things. Every prior round has handled documents, judgements and
relationships. A unit has a serial number, a location and a state, and it
outlives the Test Bed it is deployed to.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

- **Photographs are not in this round.** They need file upload, which needs
  the Google Drive question the business is settling separately and in one
  go: which Workspace, whether a service account with Drive scope exists
  and who administers it, and where a per-record folder structure lives.
  **Design the record so a photograph is an absence rather than a gap**,
  the same way Round 11 Phase 6 took a pasted URL and left the upload path
  for later.
- **Asset Management is parked.** A unit belongs to Terminus and is
  deployed to a Test Bed, and this round builds one deployment in a unit's
  life. It does not build the unit's life. See Phase 1.2, which is the only
  part of this round that would be expensive to retrofit.
- **No operational vocabulary beyond the four states.** Nothing resembling
  online, offline, firmware version or model. That is the future
  operational platform's schema and inventing it here means guessing at it.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`. Whether unit records should gate the exit
  from Installation and Commissioning is a real question and it is not this
  round's.
- **No anchor wording changes.** The business review still has not happened
  and carries nine items.
- **Record history is Round 18**, confirmed with a shape: a read-only
  History pane from `audit_log`, deliberately without readability work, so
  the business can see what it contains before deciding what each action
  should say. Plus notes carrying the stage they were written at.

---

## Standing rules that bear on this round

1. **Verification 13 and 14.** A count of zero from an instrument never
   shown to reach one is not a measurement, and a check that passes when
   both sides are absent is not a check. Rounds 12 through 16 each produced
   seven probe defects and zero product defects in the code under test.

2. **The `el.focus()` finding, recorded in Round 16 Phase 4.** A visible
   element with a correct rect and `document.activeElement` agreeing can
   still receive no keydown at all. Drive keyboard tests from a real mouse
   click, and instrument the event rather than the focus.

3. **The relocation form.** Phase 2 moves the sensors pane's role from
   Reference to a per-unit view. A move is two claims: it appears in its
   new place, and it is gone from its old one. Assert exactly one instance,
   not at least one.

4. **Presence is not legibility.** A check confirms a thing is there, only
   looking confirms it reads. Phase 2 renders a variable number of units,
   potentially dozens, and a list that is technically correct and unusable
   is the failure mode Round 15 Phase 4 shipped and caught.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

1. **The sensor counts today.** `safesightCameras`, `airQualitySensors`
   and `hemirSensors`: where they are stored, validated, rendered and read.
   Round 6 Phase 3 moved them to Commercials, and they feed the cost engine.
   Report every consumer, since Phase 3 locks them.

2. **How the Sensors pane generates its list.** Round 12 Phase 8 built it
   from the three counts as strings plus a loop index, and recorded that
   nothing links a Test Bed to a device. Round 16 Phase 2 moved it into a
   sub-tab pane. Report exactly how the list is produced today, and what
   Phase 2 replaces rather than extends.

3. **`PROTOTYPE_SPECIFICATION.md` Section 2b.** It records that the
   prototype implements a working Device-to-Test-Bed link,
   `applyDeviceLink` and `linkTargetOptions`, with linked and unlinked
   history, and that it is never surfaced. **Read it and report what it
   actually models**, including whether its shape is a unit or a
   deployment. `CLAUDE.md` rule 8 applies: if that section carries a yellow
   status marker, do the line-cited extraction pass before building against
   it. This is the closest thing to a precedent this round has.

4. **The generic records engine's fit.** A unit is plausibly a `records`
   row with a `record_type`, or plausibly its own table like
   `scoring_criteria`. Report which, with reasoning, per standing rule 4:
   **if this needs a new table, stop and report before creating one.** Note
   that a new `record_type` needs `stage_definitions` rows before
   transitions work at all, which Round 11 Phase 1 found when considering
   the same question for criteria.

5. **`createSubTabs` as a second consumer.** Round 16 Phase 1 built it for
   exactly this. Report its interface, and specifically whether it can take
   a variable number of panes generated at render time, since a Test Bed
   with 24 units is not a fixed strip of three.

6. **The Installation and Commissioning stage tab.** Report what it holds
   today. Round 6 Phase 3 moved Installer, Tech Team and Install Notes
   there, and Round 11 Phase 5 converted the first two to links. Report
   where a units view would sit relative to Terminus Documents, Exit
   Criteria and Approvals.

7. **Baseline the suite.** `npm test` and `npm run test:db` on a clean
   checkout of `main`. Keep the full output. Check residue before and
   after, enumerating from the database by `owner_id`, which Round 16
   Phase 2 established is the only thing every record type carries.

   **PGRST303 DIAGNOSED against open item 30, Phase 0, 2026-08-21. Seventh
   sighting, first measurement.** The baseline run failed 10 of 38, every
   failure `JWT issued at future`; two re-runs passed 38/38 with zero
   occurrences.

   Measured against the Supabase auth server's own `Date` header, **the host
   clock is 185ms ahead**. That is sub-second, and therefore **invisible to
   that header's one-second resolution**, which is why six previous sightings
   found "no skew" and recorded the failure as uncharacterised. With a
   **zero-tolerance `iat` check**, a token minted and used inside the same
   second reads as issued in the future.

   It fits every sighting: it clusters at the start of a run when tokens are
   freshest, it clears on re-run once the token has aged past the skew, and it
   is unrelated to any code under test. **A suite run that fails only with
   PGRST303 is not a failing suite**, and should be re-run and both results
   reported rather than either being hidden.

---

## Phase 1: The unit record

### 1.1 The fields

| Field | Notes |
|---|---|
| Type | SafeSight, Air Quality, HEMIR. Derived from which count produced the slot |
| Index | Its position within its type, so a slot is identifiable before a serial exists |
| Serial number | Free text. The physical identifier |
| Latitude, Longitude | **Per unit, not per site.** Confirmed with the business: two units on the same street have different coordinates, and this is the absolute record of where a unit is deployed |
| State | One of four, see 1.3 |
| State source | See 1.2 |

**Photographs are absent, not stubbed.** No empty field labelled Photo, which asserts that a photograph exists and has not been entered. Round 12 Phase 8 made the same call about a Serial column on the sensors list and the reasoning holds.

### AMENDED after Phase 0: build the DEPLOYMENT half only

Phase 0 item 3 found a recorded, confirmed business direction in
`PROTOTYPE_SPECIFICATION.md` Section 6 that this phase as written
contradicted. It is superseded deliberately and narrowly, with the original
left visible:

> Test Bed should consume this existing Device link mechanism rather than
> build its own serial tracking or its own linking logic.
> ...
> **Not built here, deliberately.** Connecting Test Bed's Site Details tab to
> the real Device link mechanism is a dependency of Asset Management's
> Stage 4-5 operational tracking work.

**The narrowing, which is what makes this a supersession rather than a
reversal.** That note's concern is Test Bed **inventing a parallel device
identity**: its own serial generation, its own registry, its own linking
logic, competing with the manufacturing-domain scheme. **This round does none
of those three.** The unit record parents to the Test Bed and carries
coordinates, state and state source. **The serial is a reference to the
device deployed here, typed in, not a device record.** No serial is
generated, no registry is created, no linking mechanism is built.

**The business need that overrode it:** installation is happening now and the
deployment has to be recorded somewhere; Asset Management is not scheduled.

**When Asset Management builds Device records, the serial becomes the join**
and the deployment record is already shaped to attach to it, which is the
opposite of a migration.

**And the prototype's decomposition is better than this brief's, recorded as
a correction rather than a footnote.** The prototype separates a Device,
which persists and has its own identity, from the link, which is the
deployment and carries linked and unlinked dates. **Phase 1.2 below argued
for one record holding both and was wrong on that point.** This round builds
only the deployment half, which is the half that is actually needed now, and
leaves the Device half to the module that owns it.

### 1.2 State source, and why it exists now

**A status will eventually have two possible authors: a person, and an operational platform** that deploys model updates and could report status back. The business has confirmed that platform is expected.

A record that cannot distinguish an operator's assessment from a machine's report has to be migrated when the integration lands. **One field now costs nothing and removes that migration.** It also means the eventual integration writes to the same place rather than needing a parallel path.

This is the same reasoning that made a unit a deployment rather than a unit: cheap to shape correctly now, expensive to retrofit.

### 1.3 The four states, confirmed with the business

| State | Meaning |
|---|---|
| **Planned** | The slot exists, nothing installed |
| **Installed** | Physically deployed at the recorded coordinates |
| **Faulty** | Deployed and not working |
| **Removed** | No longer at this site |

**Planned is why a slot can exist before a serial does.** Units derive from a count, so the slot exists the moment the count does. Without Planned, an empty slot and a working unit are distinguishable only by whether someone has typed a serial, which is a guess rather than a state.

Validated server-side against exactly these four, following the
`VALID_SITE_OWNERSHIP` convention rather than a picklist table, consistent
with Round 10 Phase 3.2.

**AMENDED after Phase 0: the state lives in `records.status`.** Phase 0 item
4 established that `document` is a live `record_type` using `status` for
exactly this purpose with zero `stage_definitions` rows, so the idiomatic
home is `status` and a payload field would make units the only record type
whose state is somewhere else.

**Also from item 4, to be REPORTED in Phase 1 and not solved there:**
`records_update` is `auth.uid() = owner_id`, so a unit created during setup
cannot be edited by whoever installs it. Every existing record type is
effectively single-owner and units are the first that plausibly are not.
Report the finding with evidence; do not widen the policy in this phase.

### 1.4 Derivation

Slots derive from the three Commercials counts. Twelve SafeSight cameras
means twelve SafeSight slots. **Report what happens on first render of a
Test Bed whose counts are already set**, since every existing Test Bed is
in that position.

**Test evidence required:** create units on a Test Bed with a real mixed
count, confirm the slot count matches per type, verified server-side.
Confirm serial, coordinates and state persist and survive a reload.
Confirm the state validation rejects anything outside the four,
server-side with the browser bypassed. Confirm coordinates accept a real
pair with decimal precision, since Round 15 Phase 3 established that all
numeric inputs are now `type="text"` and precision is a live concern.
Confirm two units of the same type carry different coordinates, which is
the business's stated reason for per-unit rather than per-site.

---

## Phase 2: Per-unit view, using the sub-tab component

**Round 16 Phase 1 built `createSubTabs` for exactly this**, as its second
consumer. Do not build a fourth tab strip. If its interface does not fit,
report before extending it, since Round 16 Phase 1's whole argument was
that a standalone strip would make three implementations and this would
make four.

Phase 0 item 5 reports whether it takes a variable number of panes. **A
Test Bed with 24 units is not a strip of three**, and a tab strip with 24
tabs is not usable. If the component cannot express this, say so and
propose the alternative rather than forcing it.

**AMENDED after Phase 0. Sub-tabs BY TYPE: three panes, units as a list
inside a pane.**

The component technically accepts any number of panes: `tabs` is an array
mapped over with no cap. **It is refused for one-tab-per-unit anyway**, and
the refusal is recorded rather than the capability being taken as permission.

**Why one tab per unit is wrong.** 24 tabs wrap to three or four rows of 10px
subordinate labels reading "SafeSight Camera 17", so the chrome indexing the
content is taller than the content. The APG arrow-key model degrades with it:
**reaching the last unit is 23 key presses**, where a list is one scroll.

**The shape instead:** the strip is SafeSight, Air Quality, HEMIR, fixed at
three, exactly the shape Round 16 Phase 1 proved. Each pane holds that type's
units as a list, which is what a variable count wants to be. It matches how
the counts, the cost engine and the old Sensors list already group, and it
reuses the component as its genuine second consumer without pretending 24
units are 24 sections.

**Placement:** on the Installation and Commissioning stage tab, per the
business. Phase 0 item 6 reports where relative to Terminus Documents,
Exit Criteria and Approvals.

**The Reference tab's Sensors pane.** Round 16 Phase 2 moved it there and
it lists generated strings with a not-yet-linked state. Once real units
exist, that pane either shows them or is redundant. **Report which,
and if it is redundant, assert its removal by count.** Do not leave two
places showing the same concept differently, which is the duplicate
Summary shape from Round 10.

**Test evidence required:** the view renders for a Test Bed with a real
mixed count across all three types. **Open the screenshot and report
whether it reads**, at 1, 3, 12 and 24 units, since a list correct at 3
and unusable at 24 is the failure mode. Confirm editing a unit persists
server-side. Confirm the component was reused rather than duplicated, by
naming the shared code path.

---

## Phase 3: The count locks once units are deployed

Confirmed with the business, and the reasoning is theirs: **the count is a
plan used to estimate cost at qualification; once units are deployed it is
a record of what was installed, and the two must not diverge.**

### 3.1 The rule

The count is editable until units exist for that type. Once they do, it is
locked.

**AMENDED after Phase 2: DERIVATION IS AN EXPLICIT ACTION, not a render
side effect.**

Phase 2 derived slots when the Installation and Commissioning tab rendered.
That made opening a tab create records, and under this rule it would also
have made **opening a tab lock a field on a different tab**. Someone at Site
Assessment looking at what installation involves would have locked the counts
by looking.

**The shape instead.** The Installation and Commissioning tab shows the
counts and a control saying units have not been derived yet. Pressing it
creates the slots, and from that moment the counts are locked. The user has
acted rather than been acted upon, and **the lock is attributable to a
person and a moment** rather than to a page view.

**This also resolves 3.2's stage question without a stage rule**, which is
the outcome this brief said to prefer: the control exists only on that tab,
so units cannot come into existence before Installation and Commissioning,
and the data condition and the stage condition give the same answer without
a stage condition being written anywhere.

**The principle, recorded in `DESIGN_PRINCIPLES.md`: a write must not be the
consequence of a read.** Reading a screen is how a person finds out what
something is. If that same act changes state, they cannot look without
committing, and the only safe way to explore the system becomes not to.

**The business's qualifier makes this a stage question, not only a data
one.** Costs feed qualification, so counts must stay editable through the
early stages, and units come into existence at Installation and
Commissioning. Report whether the rule is best expressed as "locked when
units exist" or "locked from stage N", and which the code should carry.
Prefer the data condition if both give the same answer, since it cannot
drift from reality.

### 3.2 The way out

**A correction is permitted with a reason recorded.** Not an unlock that
silently discards units, and not a permanent lock: if ten of twelve are
installed and the twelfth never arrives, the count is wrong and locked.

The reason writes to `audit_log`, which Round 18 surfaces. Follow the
established shape: reason required, enforced at entry rather than at save,
per Round 14 Phase 1.

**State what happens to unit records when a count is corrected downward**,
and make it a decision rather than something that falls out.

**Test evidence required:** the count edits freely with no units, refuses
once units exist, and accepts a correction with a reason. Confirm
server-side with the browser bypassed, since a client-only lock is an
affordance rather than a guarantee. Confirm the reason reaches `audit_log`
with a real actor. Confirm a Test Bed with no units in one type and units
in another locks only the locked one.

---

## Phase 4: The Commercials notice

**A field that silently refuses an edit, on a tab that says nothing about
units, is the dead-end pattern this project has argued against three
times**: Round 11 Phase 5's Tech Team dropdown when no Installer is set,
Round 12 Phase 3's read-only scores card, and Round 14 Phase 4's removed
"Created. View it".

The locked count field says why it is locked and where the units are.

Follow Round 11 Phase 5's resolution: the control is **replaced** by a line
naming what to do, rather than left present and inert.

**Test evidence required:** the notice renders when locked and not when
unlocked. Confirm it names the stage tab where units live. Confirm nothing
on it looks operable, asserted structurally as Round 12 Phase 3 did: zero
controls, zero handlers, zero focusable nodes, proven by injecting a
control and watching the count move.

---

## Phase 5: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.**
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only.

**This round adds records, and possibly a table.** If Phase 0 item 4
concluded a new table, `CURRENT_STATE.md` must record it, since a
configuration table absent from the generated file is the gap Round 11
Phase 9 found when the scoring tables were missing from the round that
built them.

Tear down by enumerating from the database by `owner_id`.

Report whether the business exercised unmerged branch code mid-round,
counting revisions rather than new records. **Open item 23 stands at full
strength**: two rounds of non-occurrence establish nothing about a
structural exposure, and Round 16 recorded the failure mode of letting
quiet rounds accumulate into a risk treated as theoretical.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **That a unit is a deployment, not a unit**, and why that shape was
  chosen while Asset Management is parked. This is the decision most likely
  to be misread later as over-engineering.
- **The state source field**, and that it exists for an integration that
  does not exist yet, which is the exception to this project's usual rule
  against building for anticipated consumers. The justification is that it
  removes a migration rather than adding a capability.
- **Phase 3's lock rule**, in the business's own terms: a plan before
  installation, a record after.
- **Phase 0 item 3's finding on Section 2b**, whichever way it goes. A
  prototype mechanism that models the same concept and was never surfaced
  is either a precedent to follow or a design that has been superseded, and
  both are worth recording.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. A report cannot sign off the phase
containing it, and a phase that ships no diff is still a phase.

**State in the close-out whether this round edited `CLAUDE.md`.**
