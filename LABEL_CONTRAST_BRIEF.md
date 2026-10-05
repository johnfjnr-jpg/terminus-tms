ROUND: LABEL_CONTRAST (cosmetic tier; estate-wide)
Base: origin/main (ls-remote; report the SHA). Branch label-contrast.
First commit: this brief verbatim as LABEL_CONTRAST_BRIEF.md.
John: field and section labels are still hard to read.

PHASE 0 (measure, no edits)
0.1 Every label style in use (field labels, section headings, table column headers, sublabels such
    as "SafeSight", captions): its colour token, font size, weight, letter-spacing, and measured
    contrast ratio against its actual background. Name where each is used.
0.2 Whether one shared token drives them, or several.

PHASE 1 (proposal, then STOP)
Raise label colours to at least 7:1 contrast against their background; propose 12px where labels
are 11px. Values must stay visibly quieter than the figures they label. Before and after screenshots
of Term Pricing (Inputs, ladder, quote, settings) and the Commercials tab, at 1240 and 1920.
STOP for John's approval. Change nothing before it.

PHASE 2 (after approval)
Apply through the shared token(s), not per-element overrides. Re-run the overlap sweep on Term
Pricing and the OPEX card at 1240 to 1920 step 40 (a larger font can wrap). Goldens and G1 to G5
unchanged. Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote
re-check; stop at "ready for John's push". Never git push.

---

BASE (2026-10-05): origin/main 8458f57 (TP_INPUTS, pushed).

---

PROPOSAL B APPROVED (John, 2026-10-03): C1 (--muted alpha 0.75), C2, S1, S2 as B, and Phase 2 widens
the units grid's column track for the 12px "UNITS" head (no override).
ADD to Phase 2:
P1 DISABLED STATES: every disabled control that paints in --muted (start-year select, Save settings,
   others found) must remain visibly dimmer than its enabled state. Measure enabled vs
   disabled contrast for each; if any disabled control reaches within 1.5:1 of its enabled form,
   STOP and propose a separate disabled token. Screenshot the start-year select and Save settings,
   enabled and disabled.
P2 ACTIVE vs INACTIVE: sidebar nav, opportunity tabs and the stage strip: the active item must stay
   clearly distinguishable from inactive ones after the change. Measure and screenshot; if the
   difference rests on colour alone and narrows below 1.5:1, STOP and report.
QUEUED, not built: the four pre-existing Commercials squeezes at 1240 (units grid head, intake head
track, PO factoring card, factoring toggle) join the opportunity-header 1240 round.
Then Phase 2 as briefed: sweep, goldens, full gate (NordVPN quit, resolver clean), merge --no-ff,
merged gate, ls-remote re-check, stop at "ready for John's push". Never git push.

---

RULING (John, 2026-10-03): option (a). Apply #deal-intake-head .deal-field { width: min-content; }
so "LUMP SUM COST" wraps to two lines. Record that the Phase 1 diagnosis (units head) was wrong and
the measured cause was the intake heading, and that the units-head fix stands on its own.
ASSERT, at 1240 to 1920 step 40: the lump-sum input and the Installation Responsibility select
share the same top and bottom edge (within 1px); the section fits its track (no squeeze); the
intake-head queued squeeze is cleared. Screenshot the Installation card at 1240 and 1920.
Remaining queued for the 1240 round: the PO factoring card and its toggle.
Then: full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check;
stop at "ready for John's push". Never git push.
