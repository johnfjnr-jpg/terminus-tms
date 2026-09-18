// W5: the record write queue. Derived from the ruling and from the measured
// defect, not from the implementation.
import { describe, test, expect } from 'vitest'
import { createRecordQueue, revisionFrom } from '../shared/recordQueue'

const ok = (revision: number | null, name = 'record_revision_number') =>
  ({ ok: true, status: 200, data: revision === null ? {} : { [name]: revision } })

describe('W5: the revision comes from the last ACCEPTED response', () => {
  test('two writes queued together expect DIFFERENT revisions', async () => {
    const seen: Array<number | null> = []
    // The host is FROZEN at 3, which is the defect's own condition: its state
    // only moves when a reload resolves, and these two writes are issued before
    // that happens.
    const q = createRecordQueue({ heldRevision: () => 3 })
    const send = (n: number) => (expected: number | null) => {
      seen.push(expected)
      return Promise.resolve(ok(n))
    }
    const a = q.write(send(4))
    const b = q.write(send(5))
    await Promise.all([a, b])
    expect(seen, 'the second write expected the revision the first consumed').toEqual([3, 4])
  })

  test('and the writes are serialised, not merely numbered', async () => {
    const order: string[] = []
    const q = createRecordQueue({ heldRevision: () => 1 })
    const slow = (label: string, ms: number, rev: number) => () => new Promise<ReturnType<typeof ok>>((res) => {
      order.push(`${label}:start`)
      setTimeout(() => { order.push(`${label}:end`); res(ok(rev)) }, ms)
    })
    const a = q.write(slow('a', 20, 2))
    const b = q.write(slow('b', 0, 3))
    await Promise.all([a, b])
    expect(order, 'the second write started before the first had finished')
      .toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  test('a 409 clears the held number, so the host\'s reload is what re-arms it', async () => {
    const seen: Array<number | null> = []
    let held = 3
    const q = createRecordQueue({ heldRevision: () => held })
    await q.write((e) => { seen.push(e); return Promise.resolve(ok(4)) })
    await q.write((e) => { seen.push(e); return Promise.resolve({ ok: false, status: 409, data: {} }) })
    // What the host does on a 409: reload, which reads the real number.
    held = 9
    await q.write((e) => { seen.push(e); return Promise.resolve(ok(10)) })
    expect(seen).toEqual([3, 4, 9])
  })

  test('a rejected write does not stop the writes behind it', async () => {
    const seen: Array<number | null> = []
    const q = createRecordQueue({ heldRevision: () => 1 })
    const bad = q.write(() => Promise.reject(new Error('the network went away')))
    await expect(bad).rejects.toThrow('the network went away')
    await q.write((e) => { seen.push(e); return Promise.resolve(ok(2)) })
    expect(seen, 'a later write never ran, so one failure silenced the surface').toEqual([1])
  })

  test('a response that advances nothing leaves the number alone', async () => {
    const seen: Array<number | null> = []
    const q = createRecordQueue({ heldRevision: () => 7 })
    await q.write((e) => { seen.push(e); return Promise.resolve(ok(null)) })
    await q.write((e) => { seen.push(e); return Promise.resolve(ok(8)) })
    expect(seen).toEqual([7, 7])
  })

  test('reset drops the number, because a different record is a different chain', async () => {
    const q = createRecordQueue({ heldRevision: () => 2 })
    await q.write(() => Promise.resolve(ok(5)))
    expect(q.held()).toBe(5)
    q.reset()
    expect(q.held()).toBeNull()
  })

  test('both route spellings of the new revision are read', () => {
    expect(revisionFrom({ record_revision_number: 4 })).toBe(4)
    expect(revisionFrom({ revision_number: 6 })).toBe(6)
    expect(revisionFrom({ revision_number: null })).toBeNull()
    expect(revisionFrom(null)).toBeNull()
  })
})
