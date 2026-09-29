# CONFIRM GOLDENS: CLOSE-OUT

Branch `confirm-goldens` off `main` at `44d70da`. The smallest round in the
project: one judgement recorded, and the guard that judgement satisfies
re-proved.

---

## WHAT CHANGED

| | |
|---|---|
| `expectations.json` | status **CONFIRMED**, `confirmedBy` John Fryatt, `confirmedOn` 2026-09-28 |
| gate stage | `golden deals (PROVISIONAL)` to **`golden deals`** |
| harness message | a green run states the figures are John-confirmed, and that pricing may not move without this suite going red and a re-confirmation |
| `DESIGN_PRINCIPLES.md` | the four golden deals are the pricing acceptance baseline of record |
| `calibrate.mjs` | the confirmation guard re-pointed and widened, 8 of 8 |

**No pricing, UI or schema change.** The 3651 figures are untouched: the
harness compared them exact on every run of this round.

---

## THE CALIBRATION IS THE ROUND

The name-and-date requirement exists because calibrating the harness once showed
that flipping the status by hand left the suite green with its provisional
warning simply gone. **This round performs that flip legitimately**, and the
risk of such a round is that satisfying a guard is indistinguishable from
disabling it.

| injection | verdict |
|---|---|
| one rate in one deal | FIRED, named G4 only |
| the rate card | FIRED on the card guard first |
| G1 loses `structure: 'single'` | FIRED |
| the Phase 0 defect reintroduced | FIRED on the vacuity guard |
| `confirmedBy` removed | **FIRED** |
| `confirmedOn` removed | **FIRED** |
| an unknown status | **FIRED**, a branch that had never run |
| the confirmed message deleted | **FIRED** |

**The old status injection had gone stale**: it anchored on the `PROVISIONAL`
this round removed, so it would have failed on a missing anchor. Verification
9's clause about a calibration anchored on the state it watches, arriving on
schedule, in the round that changed the state.

**And the harness crashed mid-sweep once, by my hand.** A case injecting into
`golden-deals-check` was added without adding that file to the snapshot list, so
`inject` threw with the in-flight marker still set. Harmless only because the
throw came before any write, which is not a property a fault-injection harness
may rely on. It now refuses an unsnapshotted file instead of crashing.

---

## THE THREE GATE RUNS, AND WHAT FIXED THE FIRST

**Run 1, red.** `HTTP readonly-view probe`, `net::ERR_ADDRESS_INVALID`, in
8,070ms against a normal of 50,244 and 52,847ms. Verification 48's signature for
a stage that has not run. Measured: Chrome could not reach ANY loopback port, on
any port, with or without `--no-sandbox`, while curl answered 200 on the same
port and external HTTPS worked. The same probe failed identically on `main`, the
tree that was green the day before, so it was not this round. Stopped and
reported rather than worked around.

> **WHAT FIXED IT: John toggled the VPN off and restarted the machine,
> 2026-09-29.** Re-measured immediately afterwards, Chrome reached
> `http://localhost:3000/` and `http://127.0.0.1:3000/` at **200** where both
> had been `ERR_ADDRESS_INVALID`, and the probe then passed in 63,014ms and
> 56,061ms, back in its normal range.

**AND THE PART THE VPN FIX DOES NOT CHANGE, recorded because the stale note
turns on it:** `http://192.168.68.55:3000/` still answers
`ERR_CONNECTION_REFUSED`, because the dev server binds `127.0.0.1` only. So
`probe-readonly-view.mjs`'s note from 2026-09-16 - which offers the host LAN IP
as the remedy - is still wrong, and was wrong for a reason unrelated to the
condition it describes. **Queued, not fixed here**, because editing it means
re-gating and this round's scope is the confirmation.

**Run 2, red for a different reason.** `HTTP review-closes probe`,
`TypeError: fetch failed`, in 71,596ms against a normal of ~27,000ms. Longer
than normal rather than shorter, which is a timeout's shape and not a defect's.
DNS answered in 13ms and TCP in 35ms when checked as separate named steps, the
session was live, and the probe passed alone in 33,165ms. Transient, while the
network settled after the VPN was toggled.

**A stage passing in isolation does not make a red gate green**, so the whole
gate was re-run rather than the result being assembled from parts.

**Run 3, green.** 26 of 26, every duration in normal range.

---

## WHAT THIS ROUND DOES NOT ESTABLISH

- **It does not check the figures.** John did that, by hand, in Excel. This
  round records the fact and guards the recording.
- **The Chrome condition is bounded, not explained.** "The VPN was toggled and
  the machine restarted" is what fixed it, not a diagnosis of why loopback died.
- **The LAN-IP claim in `probe-readonly-view.mjs` remains false** and is carried
  as a queued item rather than silently left.
