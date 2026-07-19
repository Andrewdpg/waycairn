// ui/src/App.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'
import * as apiClient from './lib/apiClient'

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'fetchRepos').mockResolvedValue({ local: [], registered: {} })
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the repo picker at /', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /repositories/i })).toBeInTheDocument()
  })
})
