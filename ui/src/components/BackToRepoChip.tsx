import { useNavigate } from 'react-router-dom'
import { CornerLeftUp } from 'lucide-react'
import { useBackStack } from '../lib/backStack'

export function BackToRepoChip({ currentRepoId }: { currentRepoId: string }) {
  const { top, pop } = useBackStack()
  const navigate = useNavigate()

  if (!top || top.repoId === currentRepoId) return null

  function handleClick() {
    const { repoId, diagramId, segments } = top!
    const parts = [`/repos/${encodeURIComponent(repoId)}/diagrams/${encodeURIComponent(diagramId)}`, ...segments.map(encodeURIComponent)]
    navigate(parts.join('/'))
    pop()
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`Back to ${top.repoId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: 'var(--surface)',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)',
        fontSize: 13,
        color: 'var(--accent-secondary)',
        cursor: 'pointer',
      }}
    >
      <CornerLeftUp size={14} />
      back to {top.repoId}
    </button>
  )
}
