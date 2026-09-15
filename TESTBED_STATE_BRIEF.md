# Test Bed state: the consolidated plumbing round

Governing docs: `CLAUDE.md`, the `tms-round-method` skill. **Architecture 12
governs the audit design.** Opened on `7b808c4`.

## MEDIUM-FULL PATH THROUGHOUT

This is **state-ownership, write-path and server work - NOT layout.** Full
verification, its own gate, and **restart discipline**: `src/` changes and the
API server runs without `--watch`, so build-discipline 9's stale-server clause
bites - **rebuild and restart before any probe measures a server change.**

**Scale principle applies**: an internal tool, a small team, proportionate
verification - but proportionate to *this*, which is data and write paths.

---

## R1 - Lift `useFieldRows` to `TestBedHost`

**The bug it fixes**: `StageTabs` renders each panel as
`active === 'x' ? panel : null`, so `TestBedPanel` **unmounts on every tab
switch** and takes its draft store with it. **Unsaved edits are discarded
silently, today.**

Lift `useFieldRows` to `TestBedHost` and pass the controller into both panels.

**Prove:**
- **(a)** edit a field on Reference, switch to Commercials, switch back - **the
  edit SURVIVES.**
- **(b)** **ONE store, not two** - edit a field on each of two tabs, save once,
  both persist, no stale state.

**Then** move Sensor Counts and Costs to the Commercials tab **through the
portal, which now works because the owner no longer unmounts**:
`commercials={null}` at `TestBedHost:526`, slot at `StageTabs:211`.

> **BLAST RADIUS**: lifting changes how `TestBedPanel` receives its controller.
> **Verify the Reference tab's existing editing still works** - same store,
> owned higher.

## R2 - Follow-up on Test Bed

**A new capability.** Test Bed has none today: no field pair, no write path,
and **the route's allowlist refuses the key with a 400** (measured).

New field pair (date + description), a write path, **and a server allowlist
change**. **Match the leads/contacts follow-up shape.**

**Prove**: set a date and description, save, **the PATCH succeeds where it
400'd**, and it renders.

## R3 - The notes/audit split

**Measured**: a field PATCH writes **NO audit row** today.

- `PATCH /contacts/:id` **and** test-beds write **STRUCTURED** audit into
  `audit_log.detail` on each field change - `{field: {from, to}}`.
- A **DISPLAY RENDERER** composes *"X changed from Y to Z"* from the stored
  detail.
- **Human notes stay in `payload.notes`.**
- **THE CLIENT NEVER COMPOSES OR WRITES AUDIT.** Architecture 12: a definer
  derives, it does not accept.

**The 20 existing mixed entries**: John ruled **leave them, going-forward-clean
(option 1)**, and asked to **RECONFIRM at this round's open** because the shape
changed from a re-wire to a server change. **Phase 0 asks.** Option 1 needs no
migration, so it is the default and the build does not block on it.

**Prove**: a field change writes a structured audit row · `/history` shows it ·
the display composes the sentence · **human notes and audit are separate
stores.**

> **BLAST RADIUS**: this touches **contacts AND test-beds** PATCH. Verify both,
> and that leads/contacts **human notes still work.**

---

## Phases

**Phase 0 - measure each, honestly, no light-path shortcuts on the write-path
items.** R1: where `useFieldRows` lives and what lifting touches. R2: the
follow-up shape to reuse, and the route allowlist. R3: the audit-write
insertion point, the display renderer, and **confirm `audit_log.detail` is the
right store.**

**Phase 1 - build all three, FULL verification**: both directions,
**clicked-not-called**, the draft-loss fix proven **by surviving a tab switch**,
and the audit split proven **by a real field change writing a structured row.**

**Own gate.** Stop at each phase for sign-off.

**John walks**: an edit surviving a tab switch · follow-up saving · a field
change appearing in history, separate from notes. **Nothing pushes.**
