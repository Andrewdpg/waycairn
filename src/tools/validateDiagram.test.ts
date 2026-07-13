import { describe, it, expect } from 'vitest'
import { validateDiagramTool } from './validateDiagram.js'

describe('validateDiagramTool', () => {
  it('returns valid: true for a well-formed diagram', () => {
    const result = validateDiagramTool({
      id: 'd', title: 'D', nodes: [{ id: 'a', label: 'A', kind: 'service' }], edges: [],
    })
    expect(result).toEqual({ valid: true })
  })

  it('returns valid: false with a reason for a malformed diagram', () => {
    const result = validateDiagramTool({ id: 'd', title: 'D', nodes: [{ id: 'a' }], edges: [] })
    expect(result.valid).toBe(false)
    expect((result as { reason: string }).reason).toMatch(/missing "label"/)
  })

  it('rejects an unrecognized field instead of silently dropping it', () => {
    // Regression guard for the exact failure that motivated this: an agent
    // (Claude Code, in practice) set an undocumented "parent" field on a
    // node hoping it meant "nest this node inside another" — it was
    // silently accepted and dropped, giving no signal the mechanism didn't
    // exist. Unknown fields must fail loudly now.
    const result = validateDiagramTool({
      id: 'd',
      title: 'D',
      nodes: [{ id: 'a', label: 'A', kind: 'service', parent: 'host' }],
      edges: [],
    })
    expect(result.valid).toBe(false)
    expect((result as { reason: string }).reason).toMatch(/unrecognized field.*parent/i)
  })

  it('rejects an unrecognized field on an edge', () => {
    const result = validateDiagramTool({
      id: 'd',
      title: 'D',
      nodes: [
        { id: 'a', label: 'A', kind: 'service' },
        { id: 'b', label: 'B', kind: 'service' },
      ],
      edges: [{ from: 'a', to: 'b', weight: 5 }],
    })
    expect(result.valid).toBe(false)
    expect((result as { reason: string }).reason).toMatch(/unrecognized field.*weight/i)
  })
})
