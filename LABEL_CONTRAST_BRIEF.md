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
