// ── E: THE TECH TEAM ────────────────────────────────────────────────────
//
// E1: a single Contact from the INSTALLER's Account, which is a different
// Account from the record's own. The buyer-row component cannot be reused: it
// reads the record's account_id, and the endpoint behind it answers 422 for any
// Contact outside it.
import type { Installer } from './installer'

export interface ContactOption { id: string, payload?: { name?: string } }

export interface TechTeamState {
  control: 'none' | 'select'
  message?: string
  placeholder?: string
  source?: string
  options: Array<{ id: string, name: string }>
  linked: string
}

/**
 * E2: NO INSTALLER MEANS NO CONTROL AT ALL, and the reason is on screen.
 *
 * The server already refuses this order with a 422, and an empty select would
 * look available and produce that refusal only after the user had tried. The
 * fourth instance of this project's standing argument that a control which
 * cannot be used is REPLACED, not disabled.
 */
export function techTeamState({ installer, contacts, linked }: {
  installer: Installer | null | undefined
  contacts: readonly ContactOption[]
  linked: string | null | undefined
}): TechTeamState {
  if (!installer) {
    return {
      control: 'none',
      message: "Set the Installer first. The Tech Team is a person from the Installer's Account.",
      options: [], linked: '',
    }
  }
  const who = installer.name ?? 'the Installer'
  return {
    control: 'select',
    // E3: an installer with NO contacts still renders the select, and the
    // placeholder says so BY NAME. Distinct from E2: there is a control here,
    // it simply has nothing in it.
    placeholder: contacts.length ? 'Select a contact' : `No Contacts at ${who} yet`,
    // E4: the Account these people come from is not the one the rest of the
    // card is about, so it is named under the control.
    source: `From ${who}`,
    options: contacts.map((c) => ({ id: c.id, name: c.payload?.name ?? c.id })),
    linked: linked ?? '',
  }
}

export const TECH_TEAM_ROUTE = (id: string) => `/api/test-beds/${id}/tech-team`
