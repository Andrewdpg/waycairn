import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Position, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { DiagramEdge } from './DiagramEdge'

function renderEdge(props: Partial<Parameters<typeof DiagramEdge>[0]> = {}) {
  return render(
    <ReactFlowProvider>
      <ReactFlow nodes={[]} edges={[]} edgeTypes={{}}>
        <DiagramEdge
          id="a->b"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={100}
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          {...props}
        />
      </ReactFlow>
    </ReactFlowProvider>
  )
}

describe('DiagramEdge', () => {
  it('renders the label text when a label is given', () => {
    renderEdge({ label: 'calls' })
    expect(screen.getByText('calls')).toBeInTheDocument()
  })

  it('renders no label element when no label is given', () => {
    const { container } = renderEdge()
    expect(container.querySelector('.badge')).toBeNull()
  })

  it('applies the same opacity from style to the label as the path receives', () => {
    renderEdge({ label: 'calls', style: { opacity: 0.15 } })
    const badge = screen.getByText('calls')
    expect(badge.style.opacity).toBe('0.15')
  })

  it('collapses the label to a small max-width by default', () => {
    renderEdge({ label: 'a much longer edge label than usual' })
    const badge = screen.getByText('a much longer edge label than usual')
    expect(badge.style.maxWidth).toBe('48px')
  })

  it('removes the max-width constraint when this edge is the hovered one', () => {
    renderEdge({ label: 'a much longer edge label than usual', data: { isHovered: true } })
    const badge = screen.getByText('a much longer edge label than usual')
    expect(badge.style.maxWidth).toBe('none')
  })
})
