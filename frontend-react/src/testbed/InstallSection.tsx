// ── N: THE INSTALL SECTION ──────────────────────────────────────────────
//
// N1: a COMPOSITION. `TB_INSTALL_FIELDS` is an empty array in the vanilla, so
// this section has no field rows of its own - it is the installer row, the
// tech team row and the install notes.
import { useState } from 'react'
import {
  matchAccounts, accountName, installerSubtitle, installerMessage,
  type AccountOption, type Installer,
} from './installer'
import { techTeamState, type ContactOption } from './techTeam'
import { addInstallNote, type InstallNote } from './installNotes'

export interface InstallSectionProps {
  installer: Installer | null
  ownAccountId?: string | null
  accounts: readonly AccountOption[]
  installerContacts: readonly ContactOption[]
  linkedTechTeam: string | null
  notes: readonly InstallNote[] | undefined
  author: string
  now: () => string
  onSetInstaller: (accountId: string) => Promise<{ cleared_tech_team?: boolean } | null>
  onSetTechTeam: (contactId: string) => Promise<void>
  onWriteNotes: (next: InstallNote[]) => Promise<boolean>
}

export function InstallSection(p: InstallSectionProps) {
  const [searching, setSearching] = useState(false)
  const [term, setTerm] = useState('')
  const [feedback, setFeedback] = useState<{ text: string, kind: 'ok' | 'err' } | null>(null)
  const [noteText, setNoteText] = useState('')

  const tt = techTeamState({
    installer: p.installer, contacts: p.installerContacts, linked: p.linkedTechTeam,
  })

  const set = async (accountId: string) => {
    const data = await p.onSetInstaller(accountId)
    if (!data) { setFeedback({ text: 'Could not set the Installer.', kind: 'err' }); return }
    setSearching(false)
    setFeedback(installerMessage(data))
  }

  return (
    <div data-testid="tb-install-section-body">
      {/* ── I2: two states, and the search is one of them ────────────── */}
      <div className="ref-field" data-key="installer" data-testid="tb-installer-row">
        <div className="ref-field-label"><span>Installer</span></div>
        {p.installer && !searching
          ? (
            <div>
              <div className="ref-field-display readonly" data-testid="tb-installer-name">
                {p.installer.name ?? '--'}</div>
              {/* I3: a derived fact, not a stored label. */}
              <p className="sub" data-testid="tb-installer-subtitle">
                {installerSubtitle(p.installer)}</p>
              <button type="button" className="btn-sm" data-testid="tb-installer-change"
                onClick={() => { setSearching(true); setTerm('') }}>Change installer</button>
            </div>)
          : (
            <div>
              <input type="text" placeholder="Search Accounts"
                data-testid="tb-installer-search"
                value={term} onChange={(e) => setTerm(e.target.value)} />
              <div className="tb-installer-results" data-testid="tb-installer-results">
                {matchAccounts(p.accounts, term).length
                  ? matchAccounts(p.accounts, term).map((a) => (
                    <div key={a.id} className="tb-installer-result"
                      data-testid={`tb-installer-result-${a.id}`}
                      onClick={() => { void set(a.id) }}>
                      {accountName(a)}
                      {/* I5: a Test Bed installed by its own client is the
                          ordinary case, and picking it should not feel like an
                          error. */}
                      {a.id === p.ownAccountId
                        ? <span className="sub" data-testid="tb-installer-own">
                            {' '}(this Test Bed&apos;s own Account)</span>
                        : null}
                    </div>))
                  : <p className="empty-state" data-testid="tb-installer-nomatch">No matches.</p>}
              </div>
              {/* Cancel only when there is something to cancel BACK to. */}
              {p.installer
                ? <button type="button" className="btn-sm" data-testid="tb-installer-cancel"
                    onClick={() => setSearching(false)}>Cancel</button>
                : null}
            </div>)}
      </div>

      {feedback
        ? <p className={`tb-doc-feedback ${feedback.kind}`} data-testid="tb-installer-feedback">
            {feedback.text}</p>
        : null}

      {/* ── E: the tech team ─────────────────────────────────────────── */}
      <div className="ref-field" data-key="techTeam" data-testid="tb-techteam-row">
        <div className="ref-field-label"><span>Tech Team</span></div>
        {tt.control === 'none'
          ? <p className="empty-state" data-testid="tb-techteam-blocked">{tt.message}</p>
          : (
            <div>
              <select data-testid="tb-techteam-select" value={tt.linked}
                onChange={(e) => {
                  // E5: an empty selection is a NO-OP, not a clear.
                  if (!e.target.value) return
                  void p.onSetTechTeam(e.target.value)
                }}>
                <option value="">{tt.placeholder}</option>
                {tt.options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
              <p className="sub" data-testid="tb-techteam-source">{tt.source}</p>
            </div>)}
      </div>

      {/* ── N2-N4: the install notes ─────────────────────────────────── */}
      <div data-testid="tb-install-notes">
        <p className="label">Install Notes</p>
        <div data-testid="tb-install-notes-list">
          {(p.notes ?? []).length
            ? (p.notes ?? []).map((n, i) => (
              <div className="ref-notes-row" key={`${n.at}-${i}`}
                data-testid={`tb-install-note-${i}`}>
                <span className="ref-notes-when">{n.at}</span>
                <span className="ref-notes-author">{n.by}</span>
                <span className="ref-notes-text">
                  {n.stage ? <span className="chip">{n.stage}</span> : null}{n.text}</span>
              </div>))
            : <p className="empty-state" data-testid="tb-install-notes-empty">
                No install notes yet.</p>}
        </div>
        <input value={noteText} data-testid="tb-install-note-input"
          onChange={(e) => setNoteText(e.target.value)} />
        <button type="button" data-testid="tb-install-note-add"
          onClick={() => {
            const next = addInstallNote(p.notes, noteText, p.author, p.now())
            if (!next) return
            void p.onWriteNotes(next).then((ok) => { if (ok) setNoteText('') })
          }}>Add note</button>
      </div>
    </div>
  )
}
