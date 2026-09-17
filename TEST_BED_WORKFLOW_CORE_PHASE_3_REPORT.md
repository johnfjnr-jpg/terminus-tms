# TEST BED WORKFLOW CORE: Phase 3 report (buyer links, B6, with the Phase 2 addenda)

**Model: this session is running Claude Opus 5 (claude-opus-5[1m]).**

## Not built, first

Nothing in 3.1 to 3.3 or in the two addenda is left unbuilt. Four positions
decide what "built" means, each taken from the vanilla at 54001c5^ under R11:

- **A linked role has no unlink.** The vanilla rendered a linked role
  read-only and offered no way to remove the link. This does the same.
- **A successful link shows no message.** The vanilla reloaded and the role
  read as linked. This does the same. Per-role feedback renders on a REFUSAL,
  which is where the vanilla rendered it, and R5's second acceptance point is
  proven on a real server refusal.
- **The role labels are the vanilla's short display names** (Comm. Buyer, Tech.
  Buyer, Legal Buyer), where the React screen showed the full role strings. The
  role VALUES written to record_contacts are unchanged.
- **The select is disabled while its own write is in flight.** The vanilla
  did not do this. The route accepts a second contact in an already-linked role
  (finding 1), so a double choice must not become two links.

## Rulings and commits

R10 and R11 and both addenda were appended to the brief under Phase 3 before
any work (d8fcbe1).

    d8fcbe1  brief: R10, R11, addenda (a) and (b)
    6c469ff  addenda: a real mid-run server refusal, and the scoring card's widths
    557c191  3.1 to 3.3: the buyer rows write directly, "+ New" through the shell seam
    3e0400b  the refusal layout fix this phase created, the door on "+ New", live probe
    8ba56c3  calibration: 15/15 unit, 3/3 live

**No server file changed**: git diff 6da809e..HEAD -- src supabase is 0 lines.

## Addendum (a): a REAL mid-run refusal, read back from the database

scripts/testbed-core/probe-p3-addenda.mjs, 18/18 (the (a) and (b) checks
together).

**How a real server refusal is produced through the UI.** Had the screen known
a criterion was already scored, its revision lock would have refused locally,
so the server would never be asked. A real refusal therefore needs the screen
and the server to disagree, which is also the one way it happens in use. Three
first scores were drafted on the screen. Then the SECOND criterion was scored
out of band through the route, as a second person would. Then Record:

    three first-score drafts at free levels: no reason is asked for, as far as the screen knows
    out of band, scoreClientCommitment is now scored once in the database  (status 201)
    the SERVER accepted the first and refused the second; the third was never sent
        (scoreRolloutPath=201, scoreClientCommitment=400)
    the refused body carried no reason, exactly as the screen believed it needed none
        ({"criterion":"scoreClientCommitment","score":3})
    the refusal is the server's REVISION rule  ("a reason for the change is required when revising a score")
    the message names both, with the server's own words
        ("Recorded Rollout Path. Client Commitment could not be recorded: a reason for the change is required when revising a score")
    exactly one new revision  (2 -> 3)
    the DATABASE holds scoreRolloutPath
    the DATABASE holds ONLY the out-of-band entry for scoreClientCommitment
    the DATABASE holds nothing for scoreUseCaseRequirementsAndMetrics
    the recorded draft cleared; the refused and the unsent stay for a retry
    after the reload the screen shows the out-of-band score it did not know about
    and now KNOWS it is a revision: the lock asks for the reason the server wanted

**This closes Phase 2's "does not establish" line on S7.** Calibrated live
(calibrate-live.mjs spec p3-addenda): with the run continuing past a refusal
built into the served bundle, the stop check and the database check both
failed (three POSTs, 201/400/201; two revisions). Sources and bundle were
restored byte-identical.

## Addendum (b): the scoring card at three widths

Measured before any capture, with one draft open so the anchors block and the
reason box are measured too:

    1240  card 876px = host;  6 rows, 0 heads with a child outside the card, 0 clipped, no card or page overflow
    1920  card 1556px = host; same
    3440  card 3076px = host; same

**Self-calibrated**: a browser-only style forcing one head wider than the card
made the checks FIRE (card overflow true), and removing it made them pass
again. Captures p3-scoring-card-1240.png and p3-scoring-card-3440.png are in
.verify/tb-core/p3-addenda/ and were NOT opened: these width claims rest on the
measurements, not on looking.

## Phase 3: what was built

| Item | Built as |
|---|---|
| 3.1 | BuyerLinks.tsx. An unlinked role is a select of the bed's OWN Account's contacts that fires POST /test-beds/:id/buyer-contacts on choice, through linkBuyer (door first); a refusal renders under that role in the server's words; a success reloads the record, and the role renders read-only with the contact's name. No linked Account says "No linked Account." |
| 3.2 | "+ New" calls the shell's shared openInlineBuyerContactModal('test_bed', ...) through a new seam method, openInlineBuyerContact, recorded in seam-ledger.test.mjs. No second modal. The host asks the door before opening it |
| 3.3 | the door both ways, proven live (below) and in host tests |

**Removed, not left:** buyerDescriptor and its "buyer rows are LOOKUPS" test,
which described the rows that could never open (P0.5); the panel's contacts
and buyers props, so the three tests that passed them fail typecheck rather
than silently passing nothing (Architecture 9); a stage refresh after a link,
which loaded nothing because the rows render only on Reference; and a
redundant empty-choice guard (calibration, below).

**Tests:** testbed-buyers.test.tsx, 14, through the real host, driven by
responses captured from the routes by scripts/testbed-core/capture-buyers.mjs:
the bed before and after a real link, the contacts list (this run's fixture
contacts only, one of them from ANOTHER Account), the real 201, and the real
422 and 404 bodies. React suite: 1146 at the Phase 2 close, 1159 now, each
emitted by its run.

## Phase 3: evidence, live

scripts/testbed-core/probe-p3-buyers.mjs, run on the committed tree
(TBCORE_RUN=p3-buyers-final): **22/22**.

    L1  Commercial is unlinked, under the vanilla label ("Comm. Buyer")
        it offers the bed's own Account's contacts and not the other Account's
        the select is VISIBLE and a click at its centre reaches it
    L2  (door OPEN)
        the choice fired POST /buyer-contacts with { role, contact_id }, accepted (201)      <- R5 acceptance 1
        the DATABASE holds the link
        the role is READ-ONLY with the contact's name, and offers no select                   <- R5 acceptance 3
    L3  Gone deleted through its own route, out of band (200)
        the SERVER refused it (404 {"error":"contact not found"})
        the refusal renders under THAT role, in the server's words ("contact not found")     <- R5 acceptance 2
        and under no other role
        the message sits BELOW the controls, inside the row
        the select keeps its width when the message appears (120 -> 120)
        the DATABASE holds no Technical link
    L4  the shell's modal opened from the React row
        the modal completed and closed
        create, link to the Account, qualify, and link in the role: four real requests, all accepted
            (POST /api/contacts 201 | link-account 200 | transition 200 | buyer-contacts 201)
        the DATABASE holds the Legal link
        the Legal row shows the new contact read-only WITHOUT a manual reload
    L5  (door CLOSED, record handed to another owner)
        the select and "+ New" are inert on an unowned record
        a forced change sends NOTHING and the database is unchanged
        a forced click on "+ New" does not open the modal
        CALIBRATION: the same listener saw the buyer POSTs earlier in this run

**3.2's seam was reachable cleanly, measured rather than assumed.** After the
modal's success, one GET /test-beds/:id followed (the shell's own reload
through loadTestBedDetailOrSayWhyNot), and the React row read as linked within
the probe's first poll. No second modal, no manual reload, and no options to
weigh.

Screenshot opened: p3-refused-1920.png, before the layout fix (where it showed
finding 3) and again in .verify/tb-core/p3-buyers-2/ after it. p3-linked-1920.png
was captured and not opened; the linked-row claims rest on the DOM and database
checks above.

## Calibration, both directions

**calibrate-unit.mjs spec p3-buyers: 15/15 fired on their named tests;
reverted React suite 1159/1159.** Injections: the old body key; the door
removed from linkBuyer; the empty-choice guard removed from the row; the
refusal losing the server's words; a linked role still offering a select; no
record reload; the message under the wrong role; every contact offered, not
the Account's own; the role string instead of the label; the select live
during its write; "+ New" losing the Account; the door removed from "+ New";
the seam opening the modal as another record type; the seam claiming a modal
it does not have; no Account not said.

**The first run was 14/16, and the two silences were a real finding
(Verification 9):** the empty-choice guard existed TWICE, in linkBuyer and in
the row, and removing either alone changed nothing. The one in linkBuyer is
removed, with the measurement written at the site. The row's is kept, and its
injection now fires.

**calibrate-live.mjs spec p3-buyers: 3/3 fired on their named live checks;
sources and bundle restored byte-identical.**

    contract: the body loses contact_id  -> the server refused 400 "contact_id is required"; the database held nothing
    door: linkBuyer no longer asks       -> a forced change on the unowned record SENT
    layout: the message beside the controls again -> select 120 -> 28px; the message above the controls' bottom

## Findings

1. **The server accepts a second contact in an already-linked role (201), and
   GET then returns both.** Measured in capture. The screen cannot create it:
   a linked role is read-only and the select is disabled in flight. The server
   rule is not this round's, so it goes on the list.
2. **The React buyer rows were lookup FieldRows the store never registered**,
   confirming P0.5's mechanism: removing buyerDescriptor and the two panel props
   was needed, not tidying, and typecheck named every stale caller.
3. **A layout defect this phase created, fixed under Rule 10's authorship
   limit.** The per-role message was a flex sibling of the controls, so a
   refusal squeezed the select to a few characters. Every assertion passed; the
   screenshot showed it. The fix stacks controls and message in one slot. The
   live probe now asserts the RELATIONSHIP (message below the controls, select
   width unchanged), and the calibration reproduced the defect exactly
   (120 -> 28px).
4. **"+ New" had no door of its own.** Only the door's disabled button stopped
   it on an unowned record, and the modal creates and qualifies a Contact before
   its last step links it. The host now asks canEditFields first; calibrated.
5. **R11, applied:** the vanilla's short role labels won over the React screen's
   full role strings, and its no-message-on-success won over a success
   confirmation. The capabilities document names neither.
6. **The live harness's own restore check found a stale bundle.** A source had
   changed after the last build, so the first p3-buyers calibration could not
   restore a byte-identical bundle, and it stopped with its marker left. Sources
   were verified byte-identical to their snapshots before the marker was
   cleared. The harness now checks bundle freshness BEFORE injecting.

## Process notes

- **Both calibration harnesses are now one spec-driven script each**
  (calibrate-unit.mjs, calibrate-live.mjs), rather than a third and fourth copy.
- **Hook database stage on this phase's commits: 123.2s to 129.9s** (K3).
- **Residue:** 89 records created by the probe identity since 03:40, including
  hook database suites; LIVE: 0.
- **Environment unchanged:** Chrome for Testing 152 via PUPPETEER_EXECUTABLE_PATH,
  the browser run outside the command sandbox.

## For the list (Rule 10), not acted on

- The route accepting a second contact in an already-linked role.
- Carried from Phase 2 and unchanged: the capabilities document's C6 and C9
  (annotated at the close, per R11), and the server refusal text naming "a
  score of 1 or 2".

## What this does not establish

- Anything about unlinking a buyer: neither the vanilla nor this build offers it.
- The buyer rows at 1240 and 3440; the live captures are 1920.
- The chevron, Back to test beds, the six read-only rows and B5's feedback id,
  which Phase 4 owns.
