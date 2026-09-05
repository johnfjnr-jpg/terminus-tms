import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { FieldRow, useFieldRows, EditBar } from '../field-row'
import type { FieldDescriptor } from '../field-row'
import { accountFieldDescriptors, ACCT_NAME_KEY } from './descriptors'

const VIEW = 'account-detail'

interface AccountRecord {
  id: string
  reference_code?: string | null
  created_at?: string | null
  parent_account_id?: string | null
  latest_revision_number?: number | null
  payload?: Record<string, unknown>
  contacts?: { id: string; status?: string | null; payload?: { name?: string } }[]
}

// ── formatDate, PORTED NOT REACHED FOR ─────────────────────────────────
// app.js's formatDate IS on window, but reading it would be a new coupling for
// a pure function. The seam exists for SERVICES, not for helpers.
const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '--'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AccountView({ accountId }: { accountId: string }) {
  const shell = useShell()
  const qc = useQueryClient()

  const account = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const r = await shell.api<AccountRecord>('GET', `/api/accounts/${accountId}`)
      if (!r.ok) throw new Error((r.data as { error?: string })?.error ?? 'The Account could not be loaded.')
      return r.data as AccountRecord
    },
    staleTime: Infinity, retry: false,
  })

  // ── THE TWO CACHES THE VANILLA READ ARE NOT REACHABLE ─────────────────
  //
  // MEASURED: terminusStaffCache and accountsCache are declared `let` at
  // app.js top level. A classic script puts `function` and `var` on window;
  // `let` and `const` do NOT go on window at all, confirmed in the browser -
  // both read `undefined`.
  //
  // So the React tree fetches them itself, which REMOVES two shell couplings
  // rather than adding two accessors to app.js. Same routes, same data.
  const staff = useQuery({
    queryKey: ['terminus-staff'],
    queryFn: async () => {
      const r = await shell.api<{ name: string }[]>('GET', '/api/terminus-staff')
      return r.ok ? (r.data ?? []) : []
    },
    staleTime: Infinity, retry: false,
  })
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const r = await shell.api<AccountRecord[]>('GET', '/api/accounts')
      return r.ok ? (r.data ?? []) : []
    },
    staleTime: Infinity, retry: false,
  })

  const rec = account.data
  const payload = rec?.payload ?? {}
  const staffNames = (staff.data ?? []).map((s) => s.name)
  const groups = accountFieldDescriptors(payload, staffNames)

  // ── ONE DRAFT STORE FOR THE WHOLE SURFACE, INCLUDING THE NAME ─────────
  //
  // MEASURED in Phase 0: ACCT_ALL_EDITABLE_FIELDS is
  // [name, ...detail, ...billing, ...shipping] and saveAcctFields reads
  // acctEdits for all fifteen. So the header already shares the store, and
  // unifying them here is faithful rather than a silent unification.
  const nameDescriptor: FieldDescriptor = {
    name: ACCT_NAME_KEY, label: 'Account Name', value: String(payload[ACCT_NAME_KEY] ?? ''),
  }
  const allFields = [nameDescriptor, ...groups.detail, ...groups.billing, ...groups.shipping]
  const rows = useFieldRows(allFields)

  const [feedback, setFeedback] = useState<{ text: string; cls: string } | null>(null)
  const [parentPanelOpen, setParentPanelOpen] = useState(false)
  const [parentQuery, setParentQuery] = useState('')
  const [parentError, setParentError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameOpen = rows.isOpen(ACCT_NAME_KEY)

  useEffect(() => { if (nameOpen) nameInputRef.current?.focus() }, [nameOpen])

  // detailLoaded on EVERY exit path. Round 41 item K.
  const settled = !account.isPending
  useEffect(() => { if (settled) shell.detailLoaded(VIEW) }, [settled, shell])

  if (account.isPending) {
    return <Frame><p className="pg-item-note">Loading the Account…</p></Frame>
  }
  if (account.isError) {
    return (
      <Frame>
        <p className="msg-error" data-testid="account-error">
          {account.error instanceof Error ? account.error.message : 'The Account could not be loaded.'}
        </p>
      </Frame>
    )
  }

  const parentName = rec?.parent_account_id
    ? ((accounts.data ?? []).find((a) => a.id === rec.parent_account_id)?.payload?.name as string ?? '--')
    : null

  // ── THE SAVE PATH, PRESERVED EXACTLY ──────────────────────────────────
  //
  // Only dirty keys. expected_revision out, revision_number adopted back, the
  // 409 sentence, the name-required refusal, and the re-fetch of BOTH the
  // record and the accounts list. Nothing here recomputes anything.
  const save = async () => {
    setFeedback(null)
    const changes = rows.changes
    if (!Object.keys(changes).length) return
    if (ACCT_NAME_KEY in changes && !changes[ACCT_NAME_KEY].trim()) {
      setFeedback({ text: 'Account Name is required.', cls: 'msg-error' }); return
    }
    const r = await shell.api<{ revision_number?: number }>('PATCH', `/api/accounts/${accountId}`,
      { payload: changes, expected_revision: rec?.latest_revision_number ?? null })
    if (!r.ok) {
      const body = r.data as { error?: string } | undefined
      setFeedback({
        text: r.status === 409
          ? (body?.error ?? 'This Account changed since the screen loaded. Reload before saving.')
          : (body?.error ?? 'Failed to save.'),
        cls: 'msg-error',
      })
      return
    }
    rows.discardAll()
    await qc.invalidateQueries({ queryKey: ['account', accountId] })
    await qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  // The parent link SAVES IMMEDIATELY and never joins the save bar. That is a
  // real column rather than a payload key, and the vanilla says so in its own
  // comment. Preserved exactly.
  const linkParent = async (parentId: string) => {
    setParentError(null)
    const r = await shell.api('PATCH', `/api/accounts/${accountId}`, { parent_account_id: parentId })
    if (!r.ok) {
      setParentError((r.data as { error?: string })?.error ?? 'Could not link that Account.'); return
    }
    setParentPanelOpen(false); setParentQuery('')
    await qc.invalidateQueries({ queryKey: ['account', accountId] })
    await qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  const q = parentQuery.trim().toLowerCase()
  const parentResults = !q ? [] : (accounts.data ?? [])
    .filter((a) => a.id !== accountId && String(a.payload?.name ?? '').toLowerCase().includes(q))
    .slice(0, 8)

  function Frame({ children }: { children: React.ReactNode }) {
    return (
      <>
        <div className="detail-head">
          <div>
            <button className="btn-text" id="btn-back-account-detail" type="button"
              onClick={() => shell.navigate('accounts')}>Back</button>
            <p className="eyebrow" style={{ marginTop: 14 }}>Account</p>
            {children}
          </div>
        </div>
      </>
    )
  }

  return (
    <div data-testid="account-view">
      <div className="detail-head">
        <div>
          <button className="btn-text" id="btn-back-account-detail" type="button"
            onClick={() => shell.navigate('accounts')}>Back</button>
          <p className="eyebrow" style={{ marginTop: 14 }}>Account</p>

          {/* ── THE NAME HEADER: NOT A ROW, AND IT KEEPS ITS SHAPE ────────
              Phase 0 measured it as an <h1 class="cd-name-display"> outside any
              .ref-field, with NO tab stop. It is rebuilt as itself rather than
              forced into a FieldRow, because turning it into a row would change
              the surface. It shares the draft store, which is what was measured.

              THE MISSING TAB STOP IS PRESERVED AND REPORTED, not quietly fixed:
              giving it one would be a behaviour change nobody asked for, and
              first contact reports rather than improves. */}
          <div data-key="name" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 id="acct-detail-name" className="cd-name-display" hidden={nameOpen}
              data-testid="display-name-header"
              onClick={() => rows.requestOpen(ACCT_NAME_KEY)}>
              {rows.valueOf(ACCT_NAME_KEY) || '--'}
            </h1>
            <div className="ref-field-edit" id="acct-edit-name" hidden={!nameOpen}>
              <input ref={nameInputRef} type="text" id="acct-input-name" className="cd-name-input"
                data-testid="input-name-header"
                value={rows.valueOf(ACCT_NAME_KEY)}
                onChange={(e) => rows.setDraft(ACCT_NAME_KEY, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); rows.close(ACCT_NAME_KEY) } }} />
              <span className="ref-field-discard" data-testid="discard-name-header"
                onClick={() => rows.discard(ACCT_NAME_KEY)}>&times;</span>
            </div>
          </div>
          <p className="sub" id="acct-detail-number">{rec?.reference_code || 'Not yet generated'}</p>
        </div>
      </div>

      <div className="ref-cards">
        <div className="pg-card">
          <p className="pg-card-title">Account Details</p>
          <div id="acct-detail-rows">
            {groups.detail.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}
            <FieldRow rows={rows}
              field={{ name: 'dateCreated', label: 'Date Created', value: formatDate(rec?.created_at), readOnly: true }} />
          </div>

          {/* The parent-account row: a read-only display plus its own control.
              Phase 0: this IS one of the two read-only rows, not a separate
              widget beside them. */}
          <div id="acct-parent-row">
            <div className="field-row" data-field="parentAccount" data-readonly="true">
              <div className="field-row-label">Parent Account</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="field-row-display" data-testid="display-parentAccount">{parentName ?? 'None'}</div>
                <button className="btn-text" style={{ marginTop: 8 }} type="button"
                  data-testid="parent-open"
                  onClick={() => setParentPanelOpen(true)}>
                  {parentName ? 'Change' : 'Link Parent Account'}
                </button>
              </div>
            </div>
            <div id="acct-parent-search-panel" hidden={!parentPanelOpen} style={{ marginTop: 8 }}>
              <input data-testid="parent-search" value={parentQuery} placeholder="Search Accounts"
                onChange={(e) => setParentQuery(e.target.value)} />
              <div data-testid="parent-results">
                {parentResults.map((a) => (
                  <div key={a.id} className="data-row" style={{ cursor: 'pointer' }}
                    data-testid={`parent-result-${a.id}`}
                    onClick={() => { void linkParent(a.id) }}>
                    <span style={{ fontSize: 13 }}>{String(a.payload?.name ?? '--')}</span>
                  </div>
                ))}
              </div>
              {parentError ? <p className="msg-error" data-testid="parent-error">{parentError}</p> : null}
            </div>
          </div>
        </div>

        <div className="pg-card">
          <p className="pg-card-title">Billing Address</p>
          <div id="acct-billing-rows">
            {groups.billing.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}
          </div>
        </div>
        <div className="pg-card">
          <p className="pg-card-title">Shipping Address</p>
          <div id="acct-shipping-rows">
            {groups.shipping.map((f) => <FieldRow key={f.name} field={f} rows={rows} />)}
          </div>
        </div>
      </div>

      <EditBar rows={rows} onSave={() => { void save() }} />
      {feedback ? <p className={feedback.cls} data-testid="acct-save-feedback">{feedback.text}</p> : null}

      <div style={{ marginTop: 28 }}>
        <p className="pg-card-title">Linked Contacts</p>
        <div id="acct-contacts-list">
          {(rec?.contacts ?? []).length === 0
            ? <p className="empty-state">No Contacts linked to this Account yet.</p>
            : (rec?.contacts ?? []).map((c) => (
              <div key={c.id} className="data-row" style={{ cursor: 'pointer' }}
                onClick={() => shell.navigate('contact-detail', c.id)}>
                <span style={{ fontSize: 13 }}>{c.payload?.name ?? '--'}</span>
                <span className="data-row-label">{c.status ?? ''}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
