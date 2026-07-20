import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlow, type Node } from '@xyflow/react'
import { DiagramNode } from './DiagramNode'
import type { DiagramNodeData } from '../lib/types'
import type { HandlePlacement } from '../lib/edgeGeometry'

function renderNode(
  data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void; opacity?: number; handlePlacements?: HandlePlacement[] }
) {
  return render(
    <ReactFlow
      // ponytail: @xyflow/react's Node<NodeData> requires NodeData to satisfy
      // Record<string, unknown>, which our own DiagramNodeData interface
      // (a specific shape, no index signature) never structurally satisfies —
      // same library-type-friction reason nodeTypes/edgeTypes are cast to
      // ComponentType<any> elsewhere in this codebase, not something worth
      // loosening the shared DiagramNodeData type for.
      nodes={[{ id: data.id, type: 'diagramNode', position: { x: 0, y: 0 }, data } as unknown as Node]}
      edges={[]}
      nodeTypes={{ diagramNode: DiagramNode }}
    />
  )
}

describe('DiagramNode', () => {
  it('renders the label', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.getByText('My Node')).toBeInTheDocument()
  })

  it('dispatches to the shape matching its kind', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'database' })
    expect(document.querySelector('[data-shape="database"]')).not.toBeNull()
  })

  it('renders the responsibility line when present', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', responsibility: 'Does the thing' })
    expect(screen.getByText('Does the thing')).toBeInTheDocument()
  })

  it('does not render a responsibility line when absent', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.queryByText('Does the thing')).not.toBeInTheDocument()
  })

  it('renders one tech icon badge per techStack entry', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', techStack: ['go', 'postgresql'] })
    expect(screen.getByTitle('Go')).toBeInTheDocument()
    expect(screen.getByTitle('PostgreSQL')).toBeInTheDocument()
  })

  it('calls onOpenDetail with the node id when the view-more button is clicked', async () => {
    const onOpenDetail = vi.fn()
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', onOpenDetail })
    await userEvent.click(screen.getByLabelText('View details for My Node'))
    expect(onOpenDetail).toHaveBeenCalledWith('n1')
  })

  it('does not render a view-more button when onOpenDetail is absent', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.queryByLabelText('View details for My Node')).not.toBeInTheDocument()
  })

  it('dims the view-more button to match the dimmed node opacity', () => {
    const onOpenDetail = vi.fn()
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', onOpenDetail, opacity: 0.3 })
    const button = screen.getByLabelText('View details for My Node')
    expect(button.style.opacity).toBe('0.3')
  })

  it('renders the kind icon next to the label', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'database' })
    expect(document.querySelector('svg.lucide-database')).not.toBeNull()
  })

  it('uses shadow-based depth instead of a hard border on the resting shape', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    const shape = document.querySelector('[data-shape="service"]') as HTMLElement
    expect(shape.style.border).toBe('')
    expect(shape.style.boxShadow).toBe('var(--shadow-card)')
  })

  it('colors each connection handle with its node kind color via --handle-color', () => {
    renderNode({
      id: 'n1',
      label: 'My Node',
      kind: 'database',
      handlePlacements: [{ id: 'n1|right|source#0', type: 'source', side: 'right', offsetFraction: 0.5 }],
    })
    const handle = document.querySelector('.diagram-handle') as HTMLElement
    expect(handle).not.toBeNull()
    expect(handle.style.getPropertyValue('--handle-color')).toBe('var(--kind-database-fg)')
  })
})
