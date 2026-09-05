import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ShellServices } from './shell-services'

// Components receive the shell through context and never through an import of
// the concrete object, so a test supplies its own without touching `window` and
// a component cannot quietly acquire a second route to the shell.
const ShellContext = createContext<ShellServices | null>(null)

export function ShellProvider(
  { services, children }: { services: ShellServices; children: ReactNode },
) {
  return <ShellContext.Provider value={services}>{children}</ShellContext.Provider>
}

export function useShell(): ShellServices {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell called outside ShellProvider')
  return ctx
}
