// ── R3: NOTES AND AUDIT ARE TWO SEPARATE CONCERNS ────────────────────────
//
// BOTH SURFACES, because the ruling named the blast radius: contacts AND test
// beds. The Contact surface is where the two were conflated; the Test Bed
// route got the same differ, and "the same code is there" is not evidence that
// it runs (Verification 40: every route the change touches is exercised from
// outside, on the SUCCESS path, asserting the new behaviour).
//
// FOUR CLAIMS PER SURFACE:
//   1. a field save writes a structured audit row
//   2. that row's detail is a DIFF, not the patch
//   3. the save does not touch payload.notes
//   4. the human note path still writes, and writes NO audit row
import { api } from '../api-client.mjs'
import { freshTestBed, freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const db = admin()
const TAG = 'tbst4'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// Read audit rows through the service client: the claim is about what is
// STORED, and reading it back through the same route that wrote it would be
// one reader proving itself.
const auditFor = async (id) => {
  const { data, error } = await db.from('audit_log')
    .select('action, detail, actor_id, timestamp').eq('record_id', id).order('timestamp')
  if (error) throw new Error(`audit read: ${error.message}`)
  return data ?? []
}
const payloadOf = async (id) => {
  const { data, error } = await db.from('record_revisions')
    .select('revision_number, payload').eq('record_id', id)
    .order('revision_number', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`payload read: ${error.message}`)
  return data
}

const surface = async (label, id, route, firstPatch, noChangePatch, noteKeyPresent, unchangedKey) => {
  console.log(`\n── ${label} ──`)
  const before = await payloadOf(id)
  // THE UNCHANGED KEY IS READ FROM THE RECORD, never typed. The first run of
  // this probe hardcoded the contact's name as `<tag> contact` where the
  // fixture stores `<tag> Contact`, so the "unchanged" key genuinely changed
  // and the DIFF claim failed on a fixture fault (Verification 47). Re-sending
  // the stored value verbatim is the only way to be sure it is unchanged.
  firstPatch = { ...firstPatch, [unchangedKey]: before.payload?.[unchangedKey] }
  console.log(`    re-sending ${unchangedKey} unchanged as ${JSON.stringify(before.payload?.[unchangedKey])}`)
  const auditBefore = (await auditFor(id)).filter((r) => r.action === 'fields_changed').length

  const r = await api('PATCH', `${route}/${id}`, {
    payload: firstPatch, expected_revision: before.revision_number,
  })
  check(r.ok, `the field save was accepted (${r.status})`)

  const rows = (await auditFor(id)).filter((a) => a.action === 'fields_changed')
  check(rows.length === auditBefore + 1,
    `exactly ONE fields_changed row was written (${auditBefore} -> ${rows.length})`)
  const detail = rows.at(-1)?.detail ?? {}
  const changes = detail.changes ?? {}
  console.log(`    detail: ${JSON.stringify(detail).slice(0, 220)}`)

  // A DIFF, NOT THE PATCH. The patch below deliberately re-sends a key at its
  // existing value; if the row carried the patch, that key would be in it.
  const sentKeys = Object.keys(firstPatch).sort()
  const loggedKeys = Object.keys(changes).sort()
  check(loggedKeys.length > 0, `the row records changes (${JSON.stringify(loggedKeys)})`)
  // `logged < sent` IS SATISFIED BY ZERO, so it passed on a run where nothing
  // was logged at all - a check reached with nothing on either side
  // (Verification 14). Both sides must exist before they are compared.
  check(loggedKeys.length > 0 && loggedKeys.length < sentKeys.length,
    `it is a DIFF, not the patch: ${loggedKeys.length} logged of ${sentKeys.length} sent`)
  const anyKey = loggedKeys[0]
  const c0 = anyKey ? changes[anyKey] : null
  check(!!c0 && 'from' in c0 && 'to' in c0,
    `each change carries from and to (${anyKey}: ${JSON.stringify(c0)})`)
  // READ DEFENSIVELY so a failed claim stays a FAILED CHECK rather than a
  // crash. The first calibration of this probe died here on an empty diff and
  // printed no verdict at all, which the harness then scored as a silent
  // detector when the injection had in fact fired.
  check(!!c0 && String(c0.to) === String(firstPatch[anyKey]),
    `"to" is the value that was actually written`)

  // 3. NOTES UNTOUCHED by a field save.
  const after = await payloadOf(id)
  const notesBefore = JSON.stringify(before.payload?.notes ?? null)
  const notesAfter = JSON.stringify(after.payload?.notes ?? null)
  check(notesBefore === notesAfter, `payload.notes is UNCHANGED by a field save`)

  // A SAVE THAT CHANGES NOTHING WRITES NO ROW.
  const n0 = (await auditFor(id)).filter((a) => a.action === 'fields_changed').length
  const r2 = await api('PATCH', `${route}/${id}`, {
    payload: noChangePatch, expected_revision: after.revision_number,
  })
  check(r2.ok, `the no-change save was accepted (${r2.status})`)
  const n1 = (await auditFor(id)).filter((a) => a.action === 'fields_changed').length
  check(n1 === n0, `a save that changes NOTHING wrote no audit row (${n0} -> ${n1})`)

  // 4. THE HUMAN NOTE PATH STILL WRITES, and writes no audit row. The paired
  // positive: "no note was written" and "notes are broken" look identical
  // without it (Verification 14).
  const cur = await payloadOf(id)
  const existing = Array.isArray(cur.payload?.notes) ? cur.payload.notes : []
  const r3 = await api('PATCH', `${route}/${id}`, {
    payload: { notes: [{ text: 'A human note', author: 'probe', at: '2026-09-15T00:00:00Z' }, ...existing] },
    expected_revision: cur.revision_number,
  })
  check(r3.ok, `the human note was accepted (${r3.status})`)
  const withNote = await payloadOf(id)
  check((withNote.payload?.notes ?? [])[0]?.text === 'A human note',
    `the human note is ON the record, at the top`)
  check((withNote.payload?.notes ?? []).length === existing.length + 1,
    `the existing history survived (${existing.length} -> ${(withNote.payload?.notes ?? []).length})`)
  const n2 = (await auditFor(id)).filter((a) => a.action === 'fields_changed').length
  check(n2 === n1, `adding a note wrote NO fields_changed row (${n1} -> ${n2})`)
  if (noteKeyPresent) {
    const logged = (await auditFor(id)).filter((a) => a.action === 'fields_changed')
      .some((a) => 'notes' in (a.detail?.changes ?? {}))
    check(!logged, `no audit row anywhere carries a copy of the notes array`)
  }
}

try {
  const tb = await freshTestBed(TAG)
  await surface('TEST BED', tb.bedId, '/test-beds',
    // `city` changes; `name` is re-sent at its existing value, so a row that
    // carried the patch rather than a diff would name it.
    { city: 'Jakarta' }, { city: 'Jakarta' }, true, 'name')

  const opp = await freshOpportunity(TAG)
  await surface('CONTACT', opp.contactId, '/contacts',
    { city: 'Jakarta' }, { city: 'Jakarta' }, true, 'name')
} finally {
  const gone = await tearDown(TAG)
  console.log(`\nteardown ${TAG}: removed ${gone.removed?.length ?? 0}, remaining ${gone.remaining}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
if (bad.length) { for (const c of bad) console.log(`  FAILED: ${c.w}`); process.exit(1) }
