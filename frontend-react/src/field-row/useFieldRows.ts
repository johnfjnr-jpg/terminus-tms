import { useCallback, useMemo, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import type { FieldDescriptor, FieldRowsController } from './types'

// ── THE SURFACE'S STATE, AND THE ONE DOOR ────────────────────────────────
//
// Behaviour 1: dirty is COMPUTED. Only the draft is stored; the original is
// read from the descriptor. That is a stronger reading of the contract than
// holding both, and it is deliberate:
//
//   - `draft !== orig` cannot go stale, because there is no second copy of
//     orig to drift from the record (Verification 20).
//   - if the record reloads while a row is open and the new value happens to
//     equal what the person typed, the field goes CLEAN. Under a stored orig
//     it would stay dirty against a value nobody holds any more. Behaviour 1
//     taken seriously produces the better answer on its own.
//
// The contract is silent on reload entirely; this is FINDING 5 in the report.
//
// Behaviour 6: the drafts live HERE, at the surface, because the bar
// aggregates across all of them and a row that owned its draft could not be
// counted by anything above it.
export function useFieldRows(fields: FieldDescriptor[]): FieldRowsController {
  const shell = useShell()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // The descriptors, addressable by name. A name that is not here is not a
  // field on this surface, and every mutator below refuses it rather than
  // creating a draft for a field that does not exist.
  const byName = useMemo(() => {
    const m = new Map<string, FieldDescriptor>()
    for (const f of fields) m.set(f.name, f)
    return m
  }, [fields])

  // Read through a ref so the callbacks below do not have to be rebuilt when a
  // descriptor's value changes, while still seeing the current one.
  const latest = useRef(byName)
  latest.current = byName

  const origOf = useCallback((name: string) => latest.current.get(name)?.value ?? '', [])
  const valueOf = useCallback(
    (name: string) => (name in drafts ? drafts[name] : origOf(name)), [drafts, origOf])
  const isDirty = useCallback((name: string) => valueOf(name) !== origOf(name), [valueOf, origOf])

  const dirtyNames = useMemo(
    () => fields.filter((f) => !f.readOnly)
      .map((f) => f.name)
      .filter((n) => (n in drafts ? drafts[n] : origOf(n)) !== origOf(n)),
    [fields, drafts, origOf])

  const changes = useMemo(() => {
    const out: Record<string, string> = {}
    for (const n of dirtyNames) out[n] = drafts[n]
    return out
  }, [dirtyNames, drafts])

  // ── THE DOOR ───────────────────────────────────────────────────────────
  //
  // ONE hook, consulted by the click handler AND the keydown handler, because
  // the defect the contract records is exactly a row that refused the mouse and
  // stayed operable by keyboard.
  //
  // The guard is CALLED HERE, at entry, on every attempt. Not read at render,
  // not captured in a memo, not turned into a prop: the contract's own note is
  // that the door covers every field that exists AND every field added later,
  // with no timing dependency, and a value captured at render has one.
  const requestOpen = useCallback((name: string, seedChar?: string): boolean => {
    const field = latest.current.get(name)
    if (!field || field.readOnly) return false
    if (!shell.canEditFields()) return false

    setOpen((o) => ({ ...o, [name]: true }))
    // Behaviour 4: the seed character is KEPT. A row that opens on a keystroke
    // and drops it has lost a behaviour nobody reports and everybody feels.
    if (seedChar) setDrafts((d) => ({ ...d, [name]: seedChar }))
    return true
  }, [shell])

  const close = useCallback((name: string) => {
    // CLOSING IS NOT DISCARDING. The draft survives, so the bar still counts it
    // and a save still sends it. Behaviour 5 says discard is not close; this is
    // the same sentence read from the other end.
    setOpen((o) => ({ ...o, [name]: false }))
  }, [])

  const setDraft = useCallback((name: string, value: string) => {
    if (!latest.current.has(name)) return
    setDrafts((d) => ({ ...d, [name]: value }))
  }, [])

  // Behaviour 5. Deleting the draft IS restoring the original, because the
  // input renders `draft ?? orig`. The row stays OPEN: the contract says
  // discard is not close, and a discard that also closed would be one.
  const discard = useCallback((name: string) => {
    setDrafts((d) => {
      if (!(name in d)) return d
      const next = { ...d }
      delete next[name]
      return next
    })
  }, [])

  const discardAll = useCallback(() => { setDrafts({}) }, [])

  return {
    fields,
    dirtyNames,
    dirtyCount: dirtyNames.length,
    changes,
    isOpen: (name) => !!open[name],
    isDirty,
    valueOf,
    requestOpen,
    close,
    setDraft,
    discard,
    discardAll,
  }
}
