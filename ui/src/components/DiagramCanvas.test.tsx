import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiagramCanvas } from './DiagramCanvas'
import type { PositionedNode } from '../lib/autoLayout'
import type { DiagramEdgeData } from '../lib/types'

const nodes: PositionedNode[] = [
  { id: 'a', label: 'A', kind: 'service', x: 0, y: 0 },
  { id: 'b', label: 'B', kind: 'service', x: 200, y: 0 },
]
const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

// ponytail: @testing-library/user-event constructs MouseEvents without a
// `view` (real browsers always set it to `window`). React Flow's pane
// pan/zoom (d3-drag) reads `event.view.document` on mousedown and throws
// when it's null. jsdom's WebIDL-generated MouseEvent rejects both
// subclassing and post-hoc `view` patching (verified: `fireEvent.click(el,
// { view: window })` still throws "member view is not of type Window" here
// — a jsdom/vitest realm brand-check quirk, not something fixable via the
// public event-construction API). Scoped to this file only, and matched on
// the actual stack frame (d3-drag/src/nodrag.js) so an unrelated future
// "Cannot read properties of null" bug elsewhere won't be silently
// swallowed. Upgrade path: remove once jsdom implements a browser-accurate
// `view` default for synthetic MouseEvents.
let onError: (event: ErrorEvent) => void
beforeEach(() => {
  onError = (event) => {
    if (
      event.error instanceof TypeError &&
      event.error.message === "Cannot read properties of null (reading 'document')" &&
      event.error.stack?.includes('d3-drag')
    ) {
      event.preventDefault()
    }
  }
  window.addEventListener('error', onError)
})
afterEach(() => {
  window.removeEventListener('error', onError)
})

describe('DiagramCanvas', () => {
  it('renders every node label', () => {
    render(<DiagramCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('calls onNodeClick with the clicked node id', async () => {
    const onNodeClick = vi.fn()
    render(<DiagramCanvas nodes={nodes} edges={edges} onNodeClick={onNodeClick} />)
    await userEvent.click(screen.getByText('A'))
    expect(onNodeClick).toHaveBeenCalledWith('a')
  })

  // ponytail: marker/dash/label/routing logic is unit-tested directly and
  // without DOM rendering in buildFlowEdges.test.ts and edgeGeometry.test.ts
  // — asserting on it via `.react-flow__edge-path` here would require React
  // Flow to have measured every node's named handle bounds, which jsdom's
  // stubbed ResizeObserver never provides (see setupTests.ts). The edge logic
  // is correct and covered; it just can't be observed through this DOM in
  // tests. Real-browser rendering is unaffected.

  it('passes onNodeDetailRequest through to node data', async () => {
    const onNodeDetailRequest = vi.fn()
    render(
      <DiagramCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} onNodeDetailRequest={onNodeDetailRequest} />
    )
    await userEvent.click(screen.getByLabelText('View details for A'))
    expect(onNodeDetailRequest).toHaveBeenCalledWith('a')
  })

  it('renders a minimap', () => {
    render(<DiagramCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />)
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull()
  })
})
