// ── I: THE INSTALLER ────────────────────────────────────────────────────
//
// Round 7 Phase 2b session 2, from the I enumeration.
//
// I1: a LINK TO AN ACCOUNT, not a picklist, so it is search-and-link rather
// than a select over a fixed list.
export interface AccountOption { id: string, payload?: { name?: string } }
export interface Installer { name?: string, client_installed?: boolean }

export const accountName = (a: AccountOption) => a.payload?.name ?? '--'

/**
 * I4: case-insensitive substring over the accounts already fetched, capped at
 * eight. No new endpoint - the same match every other Account search uses.
 *
 * An EMPTY term lists the first eight rather than nothing: a search box that
 * shows nothing until you type reads as broken.
 */
export function matchAccounts(accounts: readonly AccountOption[], term: string): AccountOption[] {
  const t = String(term ?? '').trim().toLowerCase()
  return accounts
    .filter((a) => !t || String(a.payload?.name ?? '').toLowerCase().includes(t))
    .slice(0, 8)
}

/**
 * I3: client-installed is a DERIVED FACT, not a stored label, because that is
 * exactly what it is.
 */
export const installerSubtitle = (i: Installer) =>
  i.client_installed ? 'Client installs with their own staff' : 'Installed by a contractor'

/**
 * I6: THE USER SEES THE TECH TEAM BEING CLEARED rather than discovering it.
 *
 * Changing the installer invalidates a tech team from the previous Account.
 * Saying nothing would leave a gate that was satisfied a moment ago silently
 * blocking again, with the row empty and no reason on screen - so this is an
 * ERROR-styled message, because the user has work to do.
 */
export function installerMessage(
  data: { cleared_tech_team?: boolean } | null | undefined,
): { text: string, kind: 'ok' | 'err' } {
  if (data?.cleared_tech_team) {
    return {
      kind: 'err',
      text: 'Installer changed. The previous Test Bed Tech Team belonged to the old '
        + "Installer's Account and has been cleared, so choose a new one.",
    }
  }
  return { text: 'Installer set.', kind: 'ok' }
}

export const INSTALLER_ROUTE = (id: string) => `/api/test-beds/${id}/installer`
