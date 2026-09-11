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
import { useShell } from '../ShellContext'
import { LeadCard, type LeadRecord } from './LeadCard'

interface Stage { stage_name: string, sort_order: number }

export function LeadsList({ navToken }: { navToken?: number }) {
  const shell = useShell()
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [accounts, setAccounts] = useState<Array<{ id: string, payload?: { name?: string } }>>([])
  const [loaded, setLoaded] = useState(false)

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
  }, [shell])

  useEffect(() => { void load() }, [load, navToken])

  const me = shell.currentUserId()
  const accountName = (l: LeadRecord) =>
    l.account?.name ?? accounts.find((x) => x.id === (l as { parent_record_id?: string }).parent_record_id)?.payload?.name ?? null

  const grouped = useMemo(() => {
    const order = stages.length
      ? [...stages].sort((x, y) => x.sort_order - y.sort_order).map((x) => x.stage_name)
      : []
    const byStatus = new Map<string, LeadRecord[]>()
    for (const name of order) byStatus.set(name, [])
    for (const l of leads) {
      const k = l.status ?? ''
      if (!byStatus.has(k)) byStatus.set(k, [])
      byStatus.get(k)!.push(l)
    }
    // NEWEST FIRST within each group. `created_at` descending, and the compare
    // is on the string because these are ISO timestamps - a Date round trip
    // would be a second representation for no gain.
    for (const list of byStatus.values()) {
      list.sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))
    }
    return [...byStatus.entries()].filter(([, list]) => list.length > 0)
  }, [leads, stages])

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
  if (!grouped.length) return <p className="empty-state" data-testid="leads-empty">No leads.</p>

  return (
    <div data-testid="leads-list">
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
              onSaveFollowUp={saveFollowUp} />
          ))}
        </section>
      ))}
    </div>
  )
}
