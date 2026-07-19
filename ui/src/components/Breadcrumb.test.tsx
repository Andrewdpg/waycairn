import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb', () => {
  it('renders one button per label', () => {
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={() => {}} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })

  it('calls onNavigate with the clicked index', async () => {
    const onNavigate = vi.fn()
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('Home'))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('disables the last (current) label', () => {
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={() => {}} />)
    expect(screen.getByText('API Service')).toBeDisabled()
  })
})
