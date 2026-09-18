// ── THE RECORD'S OWN WRITE QUEUE. W5, ruled by John 2026-09-18 ───────────
//
// ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────
//
// Every writer on a record surface sends `expected_revision` read from the
// host's `record.latest_revision_number`. That value only changes when `load()`
// RESOLVES and React re-renders, so two writes issued before the first one's
// reload lands both carry the SAME number and the second is refused 409.
//
// Measured on the live Test Bed before this module existed, driving John's own
// walk pairs with both clicks in one task:
//
//   Save changes then Add note      sent [200, 409], both expecting revision 3
//   tick a criterion then Add note  sent [200, 409]
//   Record scores then tick         score 201, tick 409 expecting revision 6
//
// In every case the SECOND write was lost, and on the note paths with no
// message at all, because a 409 there reloads and returns false.
//
// It is the units-queue defect one layer up: `unitQueue.ts` was built in the
// units round for exactly this shape on unit rows, and its Q3 note says why
// reading the revision at enqueue is wrong. This is the same reasoning applied
// to the record itself.
//
// ── WHAT MAKES IT CORRECT ───────────────────────────────────────────────
//
// THE REVISION COMES FROM THE LAST ACCEPTED RESPONSE, not from the host's
// state. Every route that advances a record's revision returns the new number -
// the record PATCH as `revision_number` and `record_revision_number`, the
// scores route as `revision_number`, measurability as `record_revision_number` -
// so the queue never needs a reload to know where the record is. The reload
// remains, and remains necessary, for the record's STATE: the payload, the
// derived costs, the panels. It is no longer how the next write learns a number.
//
// A 409 CLEARS THE HELD NUMBER rather than keeping a wrong one. The host
// reloads on a 409 already, so the next write falls back to what that reload
// read, which is the only case where the host's own value is the better source.
export interface RecordWriteResult {
  ok: boolean
  status?: number
  data?: unknown
}

export interface RecordQueueDeps {
  /** The revision the HOST holds, used until an accepted response supplies one. */
  heldRevision: () => number | null
}

/** Both names a revision-advancing route may answer with. */
export function revisionFrom(data: unknown): number | null {
  const d = data as { record_revision_number?: unknown, revision_number?: unknown } | null | undefined
  for (const v of [d?.record_revision_number, d?.revision_number]) {
    if (Number.isInteger(v)) return v as number
  }
  return null
}

export function createRecordQueue(deps: RecordQueueDeps) {
  let latest: number | null = null
  let chain: Promise<unknown> = Promise.resolve()

  const execute = async <T extends RecordWriteResult>(
    send: (expected: number | null) => Promise<T>,
  ): Promise<T> => {
    // Read INSIDE the link, never at enqueue: two writes queued together must
    // expect different numbers, and at enqueue they would have the same one.
    const expected = latest ?? deps.heldRevision()
    const r = await send(expected)
    if (r.ok) {
      const next = revisionFrom(r.data)
      if (next !== null) latest = next
    } else if (r.status === 409) {
      latest = null
    }
    return r
  }

  return {
    /**
     * `send` is given the revision to expect and returns the route's own
     * result. The caller keeps its own reporting: this owns the NUMBER and
     * nothing else.
     */
    write<T extends RecordWriteResult>(send: (expected: number | null) => Promise<T>): Promise<T> {
      // THE CHAIN MUST NOT BREAK. A rejected link would silently stop every
      // later write on this record, which is unitQueue's Q7 and the same
      // hazard here.
      const run = chain.then(() => execute(send), () => execute(send))
      chain = run.then(() => undefined, () => undefined)
      return run
    },
    /** A different record is a different chain: navigation must not carry a number across. */
    reset() { latest = null; chain = Promise.resolve() },
    /** For tests and for a host that wants to show what it is holding. */
    held: () => latest,
  }
}
