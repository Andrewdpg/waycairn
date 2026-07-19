import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BackStackProvider, useBackStack } from './backStack'

function wrapper({ children }: { children: ReactNode }) {
  return <BackStackProvider>{children}</BackStackProvider>
}

describe('useBackStack', () => {
  it('starts with no top entry', () => {
    const { result } = renderHook(() => useBackStack(), { wrapper })
    expect(result.current.top).toBeNull()
  })

  it('push makes the pushed entry the top', () => {
    const { result } = renderHook(() => useBackStack(), { wrapper })
    act(() => result.current.push({ repoId: 'a', diagramId: 'root', segments: [] }))
    expect(result.current.top).toEqual({ repoId: 'a', diagramId: 'root', segments: [] })
  })

  it('pop removes the top entry and reveals the one pushed before it (two-hop A to B to C)', () => {
    const { result } = renderHook(() => useBackStack(), { wrapper })
    act(() => result.current.push({ repoId: 'a', diagramId: 'root', segments: ['x'] }))
    act(() => result.current.push({ repoId: 'b', diagramId: 'root', segments: ['y'] }))
    expect(result.current.top).toEqual({ repoId: 'b', diagramId: 'root', segments: ['y'] })

    act(() => result.current.pop())
    expect(result.current.top).toEqual({ repoId: 'a', diagramId: 'root', segments: ['x'] })

    act(() => result.current.pop())
    expect(result.current.top).toBeNull()
  })

  it('pop on an empty stack is a no-op', () => {
    const { result } = renderHook(() => useBackStack(), { wrapper })
    act(() => result.current.pop())
    expect(result.current.top).toBeNull()
  })

  it('clear empties the stack', () => {
    const { result } = renderHook(() => useBackStack(), { wrapper })
    act(() => result.current.push({ repoId: 'a', diagramId: 'root', segments: [] }))
    act(() => result.current.push({ repoId: 'b', diagramId: 'root', segments: [] }))
    act(() => result.current.clear())
    expect(result.current.top).toBeNull()
  })

  it('throws when used outside a BackStackProvider', () => {
    expect(() => renderHook(() => useBackStack())).toThrow(/BackStackProvider/)
  })
})
