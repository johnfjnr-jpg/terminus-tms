// ── THE LEADS LIST ───────────────────────────────────────────────────────
//
// P4's ruled shape: stacked cards, GROUPED BY STATUS, NEWEST FIRST within each
// group.
//
// THE GROUPS ARE READ, NOT TYPED. `stage_definitions` is the configuration the
// gate itself uses, and this list already has a history of a second reader
// drifting: R5 added `company` to the gate and broke a test asserting a
// hand-written copy of those rows. The order comes from `sort_order`, so a
// stage relabelled or reordered by migration moves here without an edit -
// which is exactly what happened to Parked/Nurture three phases ago.
import { useEffect, useMemo, useState } from 'react'
import { NurtureDialog } from './NurtureDialog'
import { useShell } from '../ShellContext'
import { LeadCard, type LeadRecord } from './LeadCard'

interface Stage { stage_name: string, sort_order: number }

/**
 * R9, ruled by John 2026-09-11. THE PRODUCT RULE THAT DEFINES THIS SCREEN:
 *
 *   The Leads screen shows Unqualified and Nurture only. On qualification a
 *   lead graduates off the Leads pipeline and is worked as a Contact.
 *
 * SO THIS IS A NAMED SET, NOT A DERIVATION, and that is deliberate. "Which
 * stages are still being worked" is a product decision; no ordering or flag in
 * `stage_definitions` carries it, and inferring it as "everything except
 * Qualified" would silently adopt whatever a future migration adds.
 *
 * THE ORDER STILL COMES FROM CONFIGURATION, and the set is CHECKED against it
 * below - because a named set is exactly what went stale when `Parked` became
 * `Nurture`, and a set that quietly matches nothing empties this screen with no
 * error at all.
 */
const LEADS_PIPELINE = ['Unqualified', 'Nurture']

export function LeadsList({ navToken }: { navToken?: number }) {
  const shell = useShell()
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [accounts, setAccounts] = useState<Array<{ id: string, payload?: { name?: string } }>>([])
  const [loaded, setLoaded] = useState(false)
  // A COMPLETED-FETCH COUNTER, published on the root as `data-fetch`.
  //
  // Not for the component - for anything waiting on this list to have
  // REFRESHED. `[data-testid="leads-list"]` exists from the previous render, so
  // a probe waiting on it is satisfied by the state it is trying to watch
  // change: a lead qualified and removed from the pipeline still read as
  // present, because the read happened before the refetch landed.
  // Verification 7 - state the counterfactual, and wait on something the OLD
  // state cannot satisfy.
  const [fetches, setFetches] = useState(0)
  /** R2: which lead's Nurture dialogue is open. Null is closed. */
  const [nurturing, setNurturing] = useState<string | null>(null)

  const load = useMemo(() => async () => {
    const [c, s, a] = await Promise.all([
      shell.api<LeadRecord[]>('GET', '/api/contacts'),
      shell.api<Stage[]>('GET', '/api/stage-definitions?record_type=contact'),
      shell.api<Array<{ id: string, payload?: { name?: string } }>>('GET', '/api/accounts'),
    ])
    if (c.ok && Array.isArray(c.data)) setLeads(c.data)
    if (s.ok && Array.isArray(s.data)) setStages(s.data)
    if (a.ok && Array.isArray(a.data)) setAccounts(a.data)
    setLoaded(true)
    setFetches((n) => n + 1)
  }, [shell])

  useEffect(() => { void load() }, [load, navToken])

  const me = shell.currentUserId()
  // One shape for the account step, derived from the list's own fetch rather
  // than fetched again per card.
  const accountOptions = useMemo(
    () => accounts.map((a) => ({ id: a.id, name: a.payload?.name ?? '' }))
      .filter((a) => a.name),
    [accounts])

  const accountName = (l: LeadRecord) =>
    l.account?.name ?? accounts.find((x) => x.id === (l as { parent_record_id?: string }).parent_record_id)?.payload?.name ?? null

  const grouped = useMemo(() => {
    // ORDER FROM CONFIGURATION, MEMBERSHIP FROM THE RULE. A stage relabelled or
    // reordered by migration moves here without an edit; a stage that is not
    // part of the pipeline never appears however it is ordered.
    const configured = [...stages].sort((x, y) => x.sort_order - y.sort_order).map((x) => x.stage_name)
    const order = configured.length
      ? configured.filter((n) => LEADS_PIPELINE.includes(n))
      : LEADS_PIPELINE

    const byStatus = new Map<string, LeadRecord[]>()
    // R10: EVERY pipeline stage gets a heading, including an empty one. A
    // pipeline scan benefits from seeing that a stage is empty - "no leads in
    // Nurture" is information, and a missing heading is not.
    for (const name of order) byStatus.set(name, [])
    for (const l of leads) {
      const k = l.status ?? ''
      // R9: a Qualified lead has GRADUATED and is worked as a Contact. It is
      // dropped here rather than grouped, so this is membership and not
      // merely a hidden heading.
      if (!byStatus.has(k)) continue
      byStatus.get(k)!.push(l)
    }
    // NEWEST FIRST within each group. `created_at` descending, and the compare
    // is on the string because these are ISO timestamps - a Date round trip
    // would be a second representation for no gain.
    for (const list of byStatus.values()) {
      list.sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))
    }
    return [...byStatus.entries()]
  }, [leads, stages])

  // THE SET IS CHECKED AGAINST CONFIGURATION, and this is the guard the Parked
  // relabel earns. A pipeline name that no stage carries means this screen is
  // quietly showing fewer stages than it claims - which looks exactly like "no
  // leads in that stage" and would never be reported as a defect.
  const unknownStages = stages.length
    ? LEADS_PIPELINE.filter((n) => !stages.some((s) => s.stage_name === n))
    : []

  const addNote = async (id: string, text: string) => {
    const lead = leads.find((l) => l.id === id)
    const existing = Array.isArray(lead?.payload?.notes) ? lead!.payload!.notes as unknown[] : []
    const r = await shell.api('PATCH', `/api/contacts/${id}`, {
      payload: {
        notes: [{ text, at: new Date().toISOString(), by: shell.currentUserEmail() }, ...existing],
      },
    })
    if (r.ok) await load()
    return r.ok
  }

  const saveFollowUp = async (id: string, next: { followUpDate: string, followUpDescription: string }) => {
    const r = await shell.api('PATCH', `/api/contacts/${id}`, { payload: next })
    if (r.ok) await load()
  }

  if (!loaded) return <p className="sub" data-testid="leads-loading">Loading leads.</p>

  return (
    <div data-testid="leads-list" data-fetch={fetches}>
      {unknownStages.length
        ? <p className="msg-error" data-testid="leads-stage-mismatch">
            {`The Leads pipeline names a stage the configuration does not have: `
              + `${unknownStages.join(', ')}. Leads in it would not appear here.`}
          </p>
        : null}
      {nurturing
        ? (
          <NurtureDialog
            leadId={nurturing}
            onCancel={() => setNurturing(null)}
            onDone={() => { setNurturing(null); void load() }} />
        )
        : null}

      {grouped.map(([status, list]) => (
        <section key={status} className="lead-group" data-testid={`lead-group-${status}`}>
          <h3 className="lead-group-title" data-testid={`lead-group-title-${status}`}>
            {status} <span className="sub">{list.length}</span>
          </h3>
          {list.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              // THE DOOR'S QUESTION, PER CARD. A list has many owners, which is
              // why applyReadOnlyControls now takes a root.
              notMine={!!l.owner_id && !!me && l.owner_id !== me}
              accountName={accountName(l)}
              onOpen={(id) => shell.navigate('contact-detail', id)}
              onAddNote={addNote}
              onSaveFollowUp={saveFollowUp}
              accounts={accountOptions}
              onNurture={(id) => setNurturing(id)}
              onQualified={() => { void load() }} />
          ))}
        </section>
      ))}
    </div>
  )
}
