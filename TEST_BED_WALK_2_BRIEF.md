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
  already the title at the top of the view. **HELD: see the suspect above.**
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

**Nothing pushes.** The round stops for sign-off and John walks.
