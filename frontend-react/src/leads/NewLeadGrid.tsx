// ── THE NEW LEAD BATCH GRID ──────────────────────────────────────────────
//
// P5's ruled shape: a grid for fast batch entry, a Save bottom-right, rows
// that extend as you tab into the last one.
//
// ── THE MANDATORY SET IS DERIVED, NOT WRITTEN HERE ───────────────────────
//
// John ruled it, and this round is the reason: `company` and
// `parent_record_id` drifted apart because two places described one
// requirement. GET /contacts/creation-requirements serves the very list
// POST /contacts refuses without, so a field added to the server's tuple marks
// itself mandatory here without anybody editing this file.
//
// `jobRole` IS IN THE RULED LAYOUT AND NOT IN THE SERVER'S SET. That is
// reported rather than resolved here: making the two agree means changing what
// EVERY creation path requires, including the inline buyer-contact dialogue,
// which is not this screen's to decide. The grid marks what the server
// requires, so it cannot refuse a row the server would accept.
//
// ── AND THE MOBILE VALIDATOR IS IMPORTED, NOT COPIED ─────────────────────
//
// `isValidMobile` is the function the route calls. P1 measured that mobile is
// already enforced server-side and email is presence-only, so mobile is PROVEN
// here and email is the BUILD.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import { isValidMobile } from '../../../src/lib/field-validation.js'
import { LEAD_FIELDS } from './leadFields'
import { LeadFieldInput } from './LeadFieldInput'

// R6: ALL FIFTEEN FIELDS, from the one definition. The grid used to carry its
// own list of eight; the seven added are linkedin and the address group - the
// same seven the Qualify completion popup needs, which is why the definition
// moved out of this file rather than being copied into another.
const COLUMNS = LEAD_FIELDS

const BLANK_ROWS = 4
type Row = Record<string, string>
const blank = (): Row => Object.fromEntries(COLUMNS.map((c) => [c.key, ''])) as Row
const isEmptyRow = (r: Row) => COLUMNS.every((c) => !String(r[c.key] ?? '').trim())

/**
 * EMAIL FORMAT: P1's genuine build.
 *
 * Deliberately permissive - one `@`, something either side, a dot in the
 * domain, no spaces. A stricter pattern rejects real addresses, and this rule
 * exists to catch a typo before a batch of leads is saved, not to be RFC 5322.
 * The same reasoning `isValidMobile` records for its own exclusions.
 */
export const isValidEmail = (v: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/** Why a row cannot be saved. Empty means it can. */
export function rowProblems(row: Row, required: string[]): Record<string, string> {
  const p: Record<string, string> = {}
  for (const key of required) {
    if (!String(row[key] ?? '').trim()) p[key] = 'Required'
  }
  const email = String(row.email ?? '').trim()
  if (email && !isValidEmail(email)) p.email = 'Not an email address'
  const mobile = String(row.mobile ?? '').trim()
  if (mobile && !isValidMobile(mobile)) p.mobile = 'Not a phone number'
  return p
}

export function NewLeadGrid({ onDone, onDirtyChange }: {
  onDone?: (created: number) => void,
  /**
   * R6: THE GRID OWNS ITS DIRTY STATE AND REPORTS IT.
   *
   * The shell used to infer dirty from any `input` or `change` event inside
   * the modal panel. That guess CANNOT SEE A SAVE, which is the defect John
   * reported: save a row, the grid empties, and closing still asked to
   * discard. It also cannot see a PARTIAL save, where rows the server refused
   * stay behind and the grid is genuinely still dirty.
   *
   * Dirty is "this grid holds rows somebody typed and has not saved", which
   * is a fact only the grid has.
   */
  onDirtyChange?: (dirty: boolean) => void,
}) {
  const shell = useShell()
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: BLANK_ROWS }, blank))
  const [required, setRequired] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [industries, setIndustries] = useState<Array<{ id: string, name: string }>>([])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    void (async () => {
      const [req, ind] = await Promise.all([
        shell.api<{ required: string[], sources: string[], regions?: string[] }>('GET', '/api/contacts/creation-requirements'),
        shell.api<Array<{ id: string, name: string }>>('GET', '/api/industries'),
      ])
      if (req.ok && req.data) {
        setRequired(req.data.required); setSources(req.data.sources)
        // R3: region is a dropdown in the grid too, from the same source.
        setRegions(req.data.regions ?? [])
      }
      if (ind.ok && Array.isArray(ind.data)) setIndustries(ind.data)
    })()
  }, [shell])

  const problems = useMemo(
    () => rows.map((r) => (isEmptyRow(r) ? {} : rowProblems(r, required))),
    [rows, required])

  const set = (i: number, key: string, v: string) =>
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [key]: v } : r)))

  // THE LAST ROW AUTO-EXTENDS when focus reaches it, so a person tabbing
  // through a batch never runs out. Keyed on focus rather than on typing: the
  // row is there before they need it.
  const onFocusRow = (i: number) => {
    if (i === rows.length - 1) setRows((rs) => [...rs, blank()])
  }

  const filled = rows.map((r, i) => ({ r, i })).filter(({ r }) => !isEmptyRow(r))
  const valid = filled.filter(({ i }) => Object.keys(problems[i]).length === 0)

  const dirty = filled.length > 0
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const save = async () => {
    if (inFlight.current || !valid.length) return
    inFlight.current = true
    setSaving(true)
    const savedIdx = new Set<number>()
    let created = 0
    try {
      for (const { r, i } of valid) {
        const body: Record<string, string> = {}
        for (const c of COLUMNS) {
          const v = String(r[c.key] ?? '').trim()
          if (v) body[c.key] = v
        }
        const res = await shell.api('POST', '/api/contacts', body)
        // ONE ROW'S FAILURE IS ITS OWN. A row the server refuses stays in the
        // grid with the rest; it does not stop the ones after it.
        if (res.ok) { created++; savedIdx.add(i) }
      }
    } finally {
      // The saved rows go; everything else stays, flags and all.
      setRows((rs) => {
        const kept = rs.filter((_, i) => !savedIdx.has(i))
        const remaining = kept.length ? kept : Array.from({ length: BLANK_ROWS }, blank)
        return remaining
      })
      setResult(`${created} lead${created === 1 ? '' : 's'} created.`)
      setSaving(false)
      inFlight.current = false
      onDone?.(created)
    }
  }

  const invalidCount = filled.length - valid.length

  return (
    <div className="new-lead-grid" data-testid="new-lead-grid">
      <div className="new-lead-head">
        <span className="new-lead-title" data-testid="new-lead-title">New lead</span>
        {result
          ? <span className="sub" data-testid="new-lead-result">{result}</span>
          : null}
      </div>

      <div className="new-lead-scroll">
        <table className="new-lead-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} data-testid={`nlg-th-${c.key}`}>
                  {c.label}
                  {required.includes(c.key)
                    ? <span className="nlg-required" data-testid={`nlg-required-${c.key}`}> *</span>
                    : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const p = problems[i]
              const bad = Object.keys(p).length > 0
              return (
                <tr key={i} data-testid={`nlg-row-${i}`} data-invalid={bad ? 'true' : 'false'}>
                  {COLUMNS.map((c) => {
                    const why = touched[`${i}:${c.key}`] || bad ? p[c.key] : undefined
                    return (
                      <td key={c.key}>
                        <LeadFieldInput
                          field={c}
                          value={row[c.key] ?? ''}
                          onChange={(v) => set(i, c.key, v)}
                          industries={industries}
                          sources={sources}
                          regions={regions}
                          testid={`nlg-${c.key}-${i}`}
                          invalid={!!why}
                          describedBy={`nlg-why-${c.key}-${i}`}
                          onFocus={() => onFocusRow(i)}
                          onBlur={() => setTouched((t) => ({ ...t, [`${i}:${c.key}`]: true }))}
                          title={why} />
                        {why
                          ? <span className="nlg-why" id={`nlg-why-${c.key}-${i}`} data-testid={`nlg-why-${c.key}-${i}`}>{why}</span>
                          : null}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="new-lead-foot">
        <span className="sub" data-testid="nlg-counts">
          {`${valid.length} ready`}{invalidCount ? `, ${invalidCount} to correct` : ''}
        </span>
        {/* btn-primary is what the control this replaces carried. Verification
            7's replacement clause reaches TREATMENT, not only presence: the
            first build shipped an unclassed button, every assertion passed on
            it, and it rendered as a white browser default on a dark screen. It
            was found by opening the screenshot. */}
        <button type="button" className="btn-primary" data-testid="nlg-save" id="nlg-save"
          disabled={saving || valid.length === 0}
          onClick={() => { void save() }}>
          Save
        </button>
      </div>
    </div>
  )
}
