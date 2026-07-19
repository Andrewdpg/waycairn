// ui/src/components/DiagramScreen.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DiagramScreen } from './DiagramScreen'
import * as apiClient from '../lib/apiClient'
import type { ArtifactRecord } from '../lib/apiClient'
import type { Diagram } from '../lib/types'

function artifact(diagram: Diagram): ArtifactRecord {
  return { id: diagram.id, kind: 'diagram', updatedAt: '2026-01-01T00:00:00.000Z', data: diagram }
}

const deployment: Diagram = {
  id: 'deployment',
  title: 'Deployment',
  nodes: [{ id: 'api', label: 'API', kind: 'system', childDiagram: 'api-internals' }],
  edges: [],
}
const apiInternals: Diagram = {
  id: 'api-internals',
  title: 'API Internals',
  nodes: [{ id: 'handler', label: 'Handler', kind: 'component' }],
  edges: [],
}

const records: Record<string, Diagram> = { deployment, 'api-internals': apiInternals }

function renderScreen(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/repos/:repoId/diagrams/:diagramId/*" element={<DiagramScreen />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DiagramScreen', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'fetchArtifact').mockImplementation(async (_repoId: string, id: string) => {
      const diagram = records[id]
      return diagram ? artifact(diagram) : null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and renders the root diagram title in the breadcrumb', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment')
    expect(await screen.findByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('drills into a childDiagram when a node with one is clicked, updating the breadcrumb', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment')
    await screen.findByRole('button', { name: 'Home' })
    await userEvent.click(await screen.findByText('API'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'API Internals' })).toBeInTheDocument())
  })

  it('resolves an already-drilled-down URL (segments in the splat) directly', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment/api')
    expect(await screen.findByRole('button', { name: 'API Internals' })).toBeInTheDocument()
    expect(apiClient.fetchArtifact).toHaveBeenCalledWith('host/org/repo', 'api-internals', 'diagram')
  })

  it('shows a not-found message for a diagramId that does not exist', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/missing')
    expect(await screen.findByText(/diagram not found/i)).toBeInTheDocument()
  })
})
