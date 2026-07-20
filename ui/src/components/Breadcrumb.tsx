export interface BreadcrumbProps {
  labels: string[]
  onNavigate: (index: number) => void
}

export function Breadcrumb({ labels, onNavigate }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 4,
        padding: '8px 14px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)',
        fontSize: 13,
      }}
    >
      {labels.map((label, index) => {
        const isCurrent = index === labels.length - 1
        return (
          <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {index > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
            <button
              onClick={() => onNavigate(index)}
              disabled={isCurrent}
              style={{
                border: 'none',
                background: 'none',
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                font: 'inherit',
                color: isCurrent ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isCurrent ? 600 : 400,
                cursor: isCurrent ? 'default' : 'pointer',
                transition: 'color var(--transition), background var(--transition)',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.background = 'var(--surface-raised)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
              }}
            >
              {label}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
