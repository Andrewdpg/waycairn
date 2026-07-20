// ui/src/components/DiagramScreen.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DiagramScreen } from './DiagramScreen'
import { BackStackProvider } from '../lib/backStack'
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

// Real stored diagram artifacts never have `title` (see ui/src/lib/types.ts)
// — this is the shape that actually crashed the breadcrumb in production.
const untitledChild: Diagram = {
  id: 'untitled-child',
  nodes: [],
  edges: [],
} as Diagram
const rootWithUntitledChild: Diagram = {
  id: 'root-untitled',
  title: 'Root',
  nodes: [{ id: 'child', label: 'Child', kind: 'system', childDiagram: 'untitled-child' }],
  edges: [],
}

const externalTarget: Diagram = {
  id: 'other-root',
  title: 'Other Root',
  nodes: [],
  edges: [],
}
const withExternalRef: Diagram = {
  id: 'has-external',
  title: 'Has External',
  nodes: [
    {
      id: 'payment',
      label: 'Payment Service',
      kind: 'external',
      externalRef: { repo: 'host/org/other-repo', artifactId: 'other-root' },
    },
  ],
  edges: [],
}

const nestedBranch: Diagram = {
  id: 'nested-branch',
  title: 'Nested Branch',
  nodes: [
    { id: 'payment', label: 'Payment Service', kind: 'external', externalRef: { repo: 'host/org/other-repo', artifactId: 'other-root' } },
  ],
  edges: [],
}
const nestedRoot: Diagram = {
  id: 'nested-root',
  title: 'Nested Root',
  nodes: [{ id: 'branch', label: 'Branch', kind: 'system', childDiagram: 'nested-branch' }],
  edges: [],
}

const records: Record<string, Diagram> = {
  deployment,
  'api-internals': apiInternals,
  'root-untitled': rootWithUntitledChild,
  'untitled-child': untitledChild,
  'has-external': withExternalRef,
  'other-root': externalTarget,
  'nested-root': nestedRoot,
  'nested-branch': nestedBranch,
}

function renderScreen(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BackStackProvider>
        <Routes>
          <Route path="/repos/:repoId/diagrams/:diagramId/*" element={<DiagramScreen />} />
        </Routes>
      </BackStackProvider>
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
    expect(await screen.findByRole('button', { name: 'Deployment' })).toBeInTheDocument()
  })

  it('renders a link back to the repo home and a link back to the repo diagram list', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment')
    await screen.findByRole('button', { name: 'Deployment' })
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /host\/org\/repo/ })).toHaveAttribute('href', '/repos/host%2Forg%2Frepo')
  })

  it('drills into a childDiagram when a node with one is clicked, updating the breadcrumb', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment')
    await screen.findByRole('button', { name: 'Deployment' })
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

  it('renders an error message instead of staying blank when fetchArtifact rejects', async () => {
    vi.spyOn(apiClient, 'fetchArtifact').mockRejectedValue(new Error('server error'))
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/deployment')
    expect(await screen.findByText(/failed to load diagram/i)).toBeInTheDocument()
  })

  it('falls back to id in the breadcrumb for a diagram with no title, without crashing', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/root-untitled')
    await screen.findByRole('button', { name: 'Root' })
    await userEvent.click(await screen.findByText('Child'))
    expect(await screen.findByRole('button', { name: 'untitled-child' })).toBeInTheDocument()
  })

  it('navigates to another repo when a node with externalRef is clicked', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/has-external')
    await screen.findByRole('button', { name: 'Has External' })
    await userEvent.click(await screen.findByText('Payment Service'))
    expect(await screen.findByRole('button', { name: 'Other Root' })).toBeInTheDocument()
    await waitFor(() =>
      expect(apiClient.fetchArtifact).toHaveBeenCalledWith('host/org/other-repo', 'other-root', 'diagram')
    )
  })

  it('shows a back-to chip after an externalRef jump from a drilled-down diagram, and returns exactly there', async () => {
    renderScreen('/repos/host%2Forg%2Frepo/diagrams/nested-root/branch')
    await screen.findByRole('button', { name: 'Nested Branch' })

    await userEvent.click(await screen.findByText('Payment Service'))
    await waitFor(() =>
      expect(apiClient.fetchArtifact).toHaveBeenCalledWith('host/org/other-repo', 'other-root', 'diagram')
    )

    const chip = await screen.findByRole('button', { name: /host\/org\/repo/ })
    await userEvent.click(chip)

    expect(await screen.findByRole('button', { name: 'Nested Branch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /host\/org\/repo/ })).toBeNull()
  })
})
