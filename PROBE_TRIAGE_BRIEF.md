ROUND: PROBE_TRIAGE (John, 2026-11-18).
First commit: this brief verbatim. Branch probe-triage off origin main
4c16917 (confirm by ls-remote; STOP if different).

WHY: this week's work (term factoring, price ladder, frozen figures,
Closed Won lock, unpriced "--") is guarded by probes that each ran once
and are wired into nothing. Stale probes carry the removed formula's
figures. probe-live writes live configuration. The next round (term
quotes on opportunities) touches exactly these areas, so the gate must
guard them first.

PHASE 0 (read-only, STOP for rulings):
1. A REGISTER of every script under scripts/ named probe-*, calibrate*,
   or otherwise acting as a check: what it guards, wired into the gate
   or not, passes today or not (run it if it is read-only and safe;
   say which you did not run and why), whether it WRITES anything
   (live settings, live records, fixtures, and are fixtures torn down
   by tag), and its runtime. Assert the walk covered every file.
2. Classify each: WIRE (into the gate), REPOINT (fix stale figures or
   selectors, then wire or keep manual), MANUAL (keep, unwired, header
   says why), RETIRE (delete). Recommend per file, with the reason.
   Include the queue items: the 27 standing-rule probes with 4 rotted,
   the Term Pricing layout guard, calibrate.mjs scheduling.
3. Gate time: today's total, and the added time of everything proposed
   for WIRE. Budget: at most +4 minutes. Over budget, rank by what a
   break would cost and propose the cut.
4. probe-live: what it writes, and a proposal to make it safe or
   retire it.

BUILD (after John's rulings), each with:
- Every WIRED probe calibrated: inject the fault it guards, show it
  fail by name, restore byte-identical, reverted run green.
- No probe writes live configuration. Fixtures tagged and torn down,
  zero residue shown.
- RETIRED files deleted, each named in the register with its reason.
- The register committed as docs/PROBES.md: every check, wired or
  manual, what it guards.
- DESIGN_PRINCIPLES: a probe that guards a shipped behaviour is wired
  into the gate in the round that ships it, or the round says why not.

PHASE 3: CURRENT_STATE, full gate (report its new total time), merge,
"ready for John's push". Do not push.

STOP conditions: a wired probe cannot be made to fail by its own
fault; any probe found to have written live data; gate time over
budget with no agreed cut.

---

PHASE 0 SIGN-OFF (John, 2026-11-18), appended verbatim at the phase it
launches (build discipline 7):

PHASE 0 SIGN-OFF: PROBE_TRIAGE

Phase 0 ACCEPTED. Register 688/688.

JOHN RULES:
R1 YES: Build step 1 is one measured run of every fixture-building
   triage probe, tagged, torn down, residue by tag before and after.
   Replace section 4's estimates with measured times. Re-take the 12
   Round 41 probes' status on the measurement.
R2 YES: wire the 7 WIRE rows, probe-live (R5), term-pricing/calibrate.mjs
   and probe-overlap after their repoints; calibrators as one stage in an
   OS temp copy, never the served tree.
R3 YES: fix the price card overprint (List TCV into "Deal discount",
   seven-digit deals, 1600 to 1920) in this round. A defect fix that
   restores the approved mockup's reading, not a layout change: the
   figure must fit its cell at every width, no label moves. Send a
   capture at 1920 and 1600 on 120/40/2 units for John. Calibrate:
   reintroduce the overprint and show the layout guard fail.
R4 YES: probe-overlap in the gate at 1240/1440/1920; a declared
   scroller is not its parent's need; add a factoring-on state. The
   40px sweep stays MANUAL.
R5 YES: probe-live cut to the live RLS refusals as proposed; no admin
   grant; every attempted write targets the current value; detect by
   updated_at/updated_by. Then WIRE.
R6 YES: delete the 457 RETIRE files. Retire probe-version-join,
   probe-scrollable and probe-transition-render with them, each named
   in docs/PROBES.md with its reason.
R7 YES: wired probes write screenshots to .verify/.
R8 YES: the pure-suite test replacing q1-wiring.mjs.
BUDGET: +240s. If measured over, cut in section 4's order from the
bottom and report the cut.
QUEUED as listed in section 8. Also queued: the approver session
expired 2026-11-16; refresh it before any round that needs a second
account.

Proceed through the build and Phase 3 as briefed. Stop only on a STOP
condition. Ready for John's push at the end. Do not push.

