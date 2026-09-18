// ── UNIT CALIBRATION FOR W5's RECORD WRITE QUEUE ────────────────────────
//
// Each injection removes ONE property the queue exists to have, and is scored
// by WHICH NAMED TEST failed. The suite went green on its first run, which is
// the tell rather than the proof: these are what turn it into evidence.
const Q = 'frontend-react/src/shared/recordQueue.ts'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'w5-queue',
  testFiles: ['src/__tests__/record-queue.test.ts'],
  injections: [
    // THE DEFECT ITSELF, put back: the revision read once, for every write.
    I('the revision is read at ENQUEUE, as the host used to', Q,
      '      const run = chain.then(() => execute(send))',
      '      const at = latest ?? deps.heldRevision()\n'
      + '      const run = chain.then(() => execute(() => send(at)))',
      ['two writes queued together expect DIFFERENT revisions']),

    // The response's number ignored, so the queue falls back to host state.
    I('an accepted response\'s new revision is not kept', Q,
      '      const next = revisionFrom(r.data)\n      if (next !== null) latest = next',
      '      void revisionFrom(r.data)',
      ['two writes queued together expect DIFFERENT revisions']),

    // No serialisation: the numbering could still be right and the ORDER wrong.
    I('the writes are not serialised', Q,
      '      const run = chain.then(() => execute(send))\n      chain = run.then(() => undefined, () => undefined)',
      '      const run = execute(send)',
      ['the writes are serialised, not merely numbered']),

    // A 409 keeping its number would send the same stale one again.
    I('a 409 keeps the number it was refused on', Q,
      '    } else if (r.status === 409) {\n      latest = null\n    }', '    }',
      ['a 409 clears the held number']),

    // The chain breaking silently stops every later write on the record.
    //
    // ANCHORED ON THE SWALLOW, which is what actually provides this. The first
    // version of this injection removed a rejection handler on `chain.then`
    // and came back SILENT, because the swallow below already made that branch
    // unreachable: the silence named a redundant guard rather than a missing
    // detector, and the guard is now gone (Verification 51).
    I('a rejected link breaks the chain', Q,
      '      chain = run.then(() => undefined, () => undefined)',
      '      chain = run',
      ['a rejected write does not stop the writes behind it']),

    // One spelling only: measurability answers with the other one.
    I('only one of the two route spellings is read', Q,
      '  for (const v of [d?.record_revision_number, d?.revision_number]) {',
      '  for (const v of [d?.record_revision_number]) {',
      ['both route spellings of the new revision are read']),

    // A reset that does not reset carries one record's revision to the next.
    I('reset does not drop the number', Q,
      '    reset() { latest = null; chain = Promise.resolve() },',
      '    reset() { chain = Promise.resolve() },',
      ['reset drops the number']),
  ],
}
