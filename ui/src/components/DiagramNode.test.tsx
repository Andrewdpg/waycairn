import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { DiagramNode } from './DiagramNode'
import type { DiagramNodeData } from '../lib/types'

function renderNode(data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void }) {
  return render(
    <ReactFlowProvider>
      <DiagramNode data={data} />
    </ReactFlowProvider>
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
})
