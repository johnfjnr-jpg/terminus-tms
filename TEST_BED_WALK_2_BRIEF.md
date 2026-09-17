# Test Bed walk round 2: five layout items, and the carried door gap

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`, `DESIGN_PRINCIPLES.md` section 4 (proportionate
testing). Opened on `04f5275`.

## The path

**LIGHT**, per the Group A definition: no data, no auth, no decision changes,
so the affected suite plus a screenshot of each changed screen, one gate run
for the whole batch, no full Phase 0 forensics and no both-mode injection
calibration. The conformance gate still applies.

> **THE LIMIT, and it is the business's own: an item that turns out to change
> BEHAVIOUR rather than layout pulls onto the full path and is FLAGGED.**

**Suspects named up front**, which is the honest place for them:

- **W4** removes a block that contains the Test Bed's only NAME EDITOR. That
  is a capability removal, not a label removal, and it is held for a ruling.
- **W3 and W5** move action buttons. John has already named the instrument:
  clicked, not assumed.
- **W6** is a test addition, not layout, and takes the evidence standard a
  control deserves.

## The six items

- **W1 - ACCOUNT NAME ON THE TITLE LINE.** The client line sits under the Test
  Bed title. It goes beside it, in the smaller grey treatment, bottom-aligned
  to the title. Shared header: blast radius measured before and after.
- **W2 - AIR BETWEEN THE SUMMARY BAND AND THE STATS STRIP.** They are cramped.
- **W3 - NEXT STAGE ONTO THE SUB-TAB LINE.** It renders on its own line below
  the tab strip. It belongs at the right-hand end of the strip.
- **W4 - THE REDUNDANT TEST BED / TEST BED NAME BLOCK GOES.** The name is
  already the title at the top of the view. **RULED, see below.**
- **W5 - CONVERT TO OPPORTUNITY BESIDE THE TITLE.** It renders at the bottom
  of the host, below everything. It goes to the title area, matching the
  Opportunity's own title-area action placement.
- **W6 - CLOSE THE CARRIED DOOR GAP.** The Summary row's door protection on a
  non-owner's record is to be exercised, not assumed.

## Verify

| item | instrument |
|---|---|
| W1 | title and client share one row by equal baseline, measured in a browser |
| W2 | the gap between the two bands, before and after, in px |
| W3 | the button sits inside the tab strip, and a CLICK still fires its handler |
| W4 | the block is gone and nothing else on the surface moved |
| W5 | the trigger sits in the title area, and a CLICK still opens the form |
| W6 | the refusal test states the population it examined, and Summary is in it |

## Rulings, appended at the phase that launched them

Build discipline 7's cause clause: a ruling given in conversation is part of
the work's record, and a brief that acquires it at the close has been wrong
for every phase in between. Both were given at the open, before Phase 2.

**R1 - W4 DOES NOT DELETE THE NAME ROW, IT MOVES IT.** Put to John with the
measurement that `row('name')` was the only place a Test Bed's name could be
edited after creation. **His ruling: put it in the Terminus Details panel
where it can be edited with the other data fields there.** So W4 removes the
eyebrow and the header block, and the row leads Terminus Details. No
capability is lost and the item stays on the light path.

**R2 - W3 AND W5 MOVE ONLY. THE BUTTONS STAY UNSTYLED.** Put to John that
both carry no class and render as browser defaults, that they are on the
carried list as "the two unstyled buttons", and that the vanilla dressed Next
Stage as `btn-sm btn-primary` inside `.tb-tab-actions`. **His ruling: move
only, leave them unstyled.** So the tab-row wrapper is taken for POSITION -
`margin-left: auto`, which is what puts the action at the right-hand end -
and neither button gains a class. The carried item stays open.

**R3 - THE HEADER SUMMARY IS REMOVED.** The summary renders once, as the
editable field. The duplicate beside the title (`tb-header-summary`,
`ViewHeader.tsx`) is deleted. Ruled by John 2026-09-17. Closes the report's
"On the list" item 4. Recorded as a ruling; the deletion itself is not built by
this commit.

**R4 - W3 AS BUILT STANDS.** The moved buttons keep their current structural
wrapper, unstyled. The report's open item at "Departures from instruction" 1
(W3's wrapper) is closed. Ruled by John 2026-09-17.

**R5 - THE CONVERT MESSAGE STAYS WITH ITS TRIGGER.** The report's open item at
"Departures from instruction" 2 (W5's feedback travels with the trigger) is
closed. Ruled by John 2026-09-17.

**Nothing pushes.** The round stops for sign-off and John walks.
