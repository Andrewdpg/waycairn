import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch } from 'lucide-react'

export interface RepoCardData {
  id: string
  name: string
  path: string
}

export function RepoCard({ repo }: { repo: RepoCardData }) {
  return (
    <Link to={`/repos/${encodeURIComponent(repo.id)}`} className="card card-link" style={{ padding: 16, gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repo.name}
          </strong>
        </div>
        <ArrowRight size={16} className="card-arrow" color="var(--text-muted)" />
      </div>
      <p
        aria-hidden="true"
        style={{
          margin: '2px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {repo.path}
      </p>
      <p aria-hidden="true" style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
        {repo.id}
      </p>
    </Link>
  )
}

export function UnregisteredRepoCard({ path }: { path: string }) {
  const name = path.split('/').filter(Boolean).pop() ?? path
  return (
    <div className="card card-dashed" style={{ padding: 16, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GitBranch size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>{name}</strong>
      </div>
      {path !== name && (
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{path}</p>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
        }}
      >
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>$</span>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>waycairn init</code>
      </div>
    </div>
  )
}
