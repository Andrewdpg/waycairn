import { createContext, useContext, useState, type ReactNode } from 'react'

export interface BackStackEntry {
  repoId: string
  diagramId: string
  segments: string[]
}

interface BackStackContextValue {
  top: BackStackEntry | null
  push: (entry: BackStackEntry) => void
  pop: () => void
}

const BackStackContext = createContext<BackStackContextValue | null>(null)

export function BackStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<BackStackEntry[]>([])

  function push(entry: BackStackEntry) {
    setStack((s) => [...s, entry])
  }

  function pop() {
    setStack((s) => s.slice(0, -1))
  }

  const top = stack.length > 0 ? stack[stack.length - 1] : null

  return <BackStackContext.Provider value={{ top, push, pop }}>{children}</BackStackContext.Provider>
}

export function useBackStack(): BackStackContextValue {
  const ctx = useContext(BackStackContext)
  if (!ctx) throw new Error('useBackStack must be used within a BackStackProvider')
  return ctx
}
