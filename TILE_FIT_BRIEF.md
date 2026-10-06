ROUND: TILE_FIT (cosmetic tier)
Base: origin/main expected ebc9698 (ls-remote; mismatch, STOP). Branch tile-fit.
First commit: this brief verbatim as TILE_FIT_BRIEF.md.
John's screenshot (2026-10-06): CAPEX, split WHT grossed up, 120 months, seven summary tiles; figures
run into the next tile's border (queued "seven-tile squeeze").

RULINGS (John, 2026-10-06)
F1 The summary tiles' figures share ONE font size: the largest size at which the widest figure in
   the row fits its tile (measured, including padding). Applied to every tile alike; recomputed when
   figures, tile count or width change.
F2 The lead figure (first tile) keeps its current proportion to the others (22:17 today).
F3 Floor 13px for the standard figures. If the row cannot fit at 13px, the tiles wrap to a second
   row instead of shrinking further, all tiles equal width.
F4 Labels and the floor chip unchanged.
EXIT
E1 Goldens and G1 to G5 unchanged (no figure moves).
E2 Overlap sweep 1240 to 1920 step 40, all 24 states at the demo deal's units: the 44 seven-tile
   failures go to 0; zero overlaps; every figure inside its tile; one shared size per row asserted.
   Calibrate: a planted per-tile size fires the shared-size check; a planted floor of 8px fires F3.
E3 Screenshots at 1240, 1600 and 1920 of the CAPEX split grossed-up state (John's) and the OPEX
   five-tile state, before and after.
E4 Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check; stop at
   "ready for John's push". Never git push.

---

BASE (2026-10-06): origin/main ebc9698, as expected.
