import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect, useState, type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepoPicker } from './RepoPicker'
import { BackStackProvider, useBackStack } from '../lib/backStack'
import * as apiClient from '../lib/apiClient'

function TopProbe({ onTop }: { onTop: (top: ReturnType<typeof useBackStack>['top']) => void }) {
  const { top } = useBackStack()
  onTop(top)
  return null
}

function SeededStack({ children }: { children: ReactNode }) {
  const { push } = useBackStack()
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    push({ repoId: 'host/org/stale', diagramId: 'root', segments: [] })
    setSeeded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!seeded) return null
  return <>{children}</>
}

function renderPicker() {
  return render(
    <MemoryRouter>
      <BackStackProvider>
        <RepoPicker />
      </BackStackProvider>
    </MemoryRouter>
  )
}

describe('RepoPicker', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'fetchRepos').mockResolvedValue({
      local: ['unregistered-repo'],
      registered: {
        'host/org/repo': { path: '/somewhere/repo', name: 'repo' },
        'host/org/other': { path: '/somewhere/other', name: 'other' },
      },
    })
    vi.spyOn(apiClient, 'fetchRepoGraph').mockResolvedValue({
      groups: [['host/org/repo'], ['host/org/other']],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders registered repos as links to /repos/:repoId', async () => {
    renderPicker()
    const link = await screen.findByRole('link', { name: /^repo$/i })
    expect(link).toHaveAttribute('href', '/repos/host%2Forg%2Frepo')
  })

  it('renders local (unregistered) repos as plain, non-link text under a "Not registered" heading', async () => {
    renderPicker()
    await waitFor(() => expect(screen.getByText('unregistered-repo')).toBeInTheDocument())
    expect(screen.getByText('unregistered-repo').closest('a')).toBeNull()
    expect(screen.getByText(/not registered/i)).toBeInTheDocument()
  })

  it('renders an error message instead of staying blank when fetchRepos rejects', async () => {
    vi.spyOn(apiClient, 'fetchRepos').mockRejectedValue(new Error('network error'))
    renderPicker()
    expect(await screen.findByText(/failed to load repositories/i)).toBeInTheDocument()
  })

  it('labels a multi-repo connected group as "Connected", and leaves standalone groups unlabeled', async () => {
    vi.spyOn(apiClient, 'fetchRepoGraph').mockResolvedValue({
      groups: [['host/org/repo', 'host/org/other']],
    })
    renderPicker()
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('filters the visible repos by search query', async () => {
    renderPicker()
    await screen.findByRole('link', { name: /^repo$/i })
    await userEvent.type(screen.getByRole('searchbox', { name: /search repositories/i }), 'other')
    expect(screen.queryByRole('link', { name: /^repo$/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^other$/i })).toBeInTheDocument()
  })

  it('shows a "no matches" message when the search query matches no repos', async () => {
    renderPicker()
    await screen.findByRole('link', { name: /^repo$/i })
    await userEvent.type(screen.getByRole('searchbox', { name: /search repositories/i }), 'zzz-no-match')
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/no repositories match your search/i)).toBeInTheDocument()
  })

  it('clears a pre-existing back stack on mount', async () => {
    let latestTop: ReturnType<typeof useBackStack>['top'] = undefined as never
    render(
      <MemoryRouter>
        <BackStackProvider>
          <SeededStack>
            <TopProbe onTop={(top) => (latestTop = top)} />
            <RepoPicker />
          </SeededStack>
        </BackStackProvider>
      </MemoryRouter>
    )
    await screen.findByRole('link', { name: /^repo$/i })
    expect(latestTop).toBeNull()
  })
})
