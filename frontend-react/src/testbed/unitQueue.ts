// ── Q: THE PER-ROW UNIT WRITE QUEUE ─────────────────────────────────────
//
// Round 7 Phase 1b, built from the Q enumeration.
//
// Nothing is dropped or coalesced. A person cannot outrun this guard; they can
// only lengthen the queue, and the cost of lengthening it is latency rather
// than a lost write.
export interface UnitLike { id: string, revision_number?: number | null }
export type PatchResult = { ok: boolean, status?: number, data?: unknown }

export interface RowState {
  pending: number
  /** Q5: keyed BY FIELD, and outliving the burst. */
  failures: Map<string, string>
  message: string
}

export interface QueueDeps {
  patch: (
    unitId: string, field: string, value: string, expectedRevision: number | null,
  ) => Promise<PatchResult>
  /** Read at EXECUTION, which is the whole of Q3. */
  unitById: (unitId: string) => UnitLike | undefined
  onUnit: (unit: unknown) => void
  onRowState: (unitId: string, state: RowState) => void
}

export function createUnitQueues(deps: QueueDeps) {
  const queues = new Map<string, { chain: Promise<void>, pending: number, failures: Map<string, string> }>()

  // Q1: ONE QUEUE PER ROW, so two rows do not serialise against each other.
  const queueFor = (unitId: string) => {
    let q = queues.get(unitId)
    if (!q) { q = { chain: Promise.resolve(), pending: 0, failures: new Map() }; queues.set(unitId, q) }
    return q
  }

  /**
   * Q6: settle ONCE PER DRAIN, and name the FIRST unresolved failure rather
   * than the most recent - the earliest thing that went wrong is the one to
   * fix first.
   */
  const settle = (unitId: string, q: { pending: number, failures: Map<string, string> }) => {
    deps.onRowState(unitId, {
      pending: q.pending,
      failures: q.failures,
      message: q.failures.size ? [...q.failures.values()][0] : 'Saved',
    })
  }

  const write = (unitId: string, field: string, value: string): Promise<void> => {
    const q = queueFor(unitId)
    q.pending += 1
    // Q8: the cell says Saving at enqueue.
    deps.onRowState(unitId, { pending: q.pending, failures: q.failures, message: 'Saving' })

    q.chain = q.chain.then(async () => {
      // ── Q3: THE REVISION IS READ HERE, INSIDE THE LINK ─────────────────
      //
      // Not when the change fired. Three fields entered at paste speed queue
      // three writes, and each must expect the revision the one before it
      // produced. Reading it at enqueue would give all three the same number
      // and refuse two - the failure this queue exists to remove, arriving
      // from the other direction.
      const held = deps.unitById(unitId)
      const expected = Number.isInteger(held?.revision_number)
        ? (held!.revision_number as number) : null
      const result = await deps.patch(unitId, field, value, expected)
      if (!result.ok) {
        q.failures.set(field, result.status === 409
          ? 'Someone else changed this unit. Reload before saving.'
          : ((result.data as { error?: string })?.error ?? 'Save failed'))
        return
      }
      // Q5: this field is good again, so its outstanding refusal is resolved.
      q.failures.delete(field)
      // Q4: replace the local unit, which is what makes Q3 true for the next link.
      if (result.data) deps.onUnit(result.data)
    }).catch(() => {
      // Q7: THE CHAIN MUST NOT BREAK. A rejected link would silently stop
      // every later write for this row.
      q.failures.set(field, 'Save failed')
    }).then(() => {
      q.pending -= 1
      if (q.pending === 0) settle(unitId, q)
    })

    return q.chain
  }

  return { write, pendingFor: (unitId: string) => queues.get(unitId)?.pending ?? 0 }
}
