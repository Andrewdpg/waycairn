import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Box, Braces, Database, ExternalLink, Package, Puzzle, Search, Server, Table2, Waypoints } from 'lucide-react'
import { fetchArtifacts, type ArtifactRecord } from '../lib/apiClient'
import { computeRootDiagrams, searchDiagrams, type DiagramSummary } from '../lib/rootDiagrams'
import type { NodeKind } from '../lib/types'

const KIND_ICON: Record<NodeKind, typeof Box> = {
  system: Box,
  container: Package,
  component: Puzzle,
  service: Waypoints,
  server: Server,
  database: Database,
  class: Braces,
  external: ExternalLink,
  bridge: Waypoints,
  table: Table2,
}

function KindStrip({ kinds }: { kinds: NodeKind[] }) {
  if (kinds.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 4 }} aria-hidden="true">
      {kinds.slice(0, 6).map((k) => {
        const Icon = KIND_ICON[k]
        return (
          <span
            key={k}
            title={k}
            style={{
              display: 'inline-flex',
              width: 22,
              height: 22,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              background: `var(--kind-${k}-bg)`,
              color: `var(--kind-${k}-fg)`,
            }}
          >
            <Icon size={12} />
          </span>
        )
      })}
    </div>
  )
}

function DiagramCard({ repoId, artifact }: { repoId: string; artifact: ArtifactRecord }) {
  const diagram = artifact.data as { title?: string; nodes?: { kind: NodeKind }[]; notation?: string }
  const kinds = [...new Set((diagram.nodes ?? []).map((n) => n.kind))]
  return (
    <Link
      to={`/repos/${encodeURIComponent(repoId)}/diagrams/${encodeURIComponent(artifact.id)}`}
      className="card card-link"
      style={{ padding: 16, gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 500 }}>{diagram.title ?? artifact.id}</strong>
          <p aria-hidden="true" style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
            {artifact.id}
          </p>
        </div>
        <ArrowRight size={16} className="card-arrow" color="var(--text-muted)" />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
        }}
      >
        <KindStrip kinds={kinds} />
        <span className="badge" aria-hidden="true">
          {diagram.nodes?.length ?? 0} nodes
        </span>
      </div>
    </Link>
  )
}

export function RootDiagramsScreen() {
  const { repoId } = useParams<{ repoId: string }>()
  const [artifacts, setArtifacts] = useState<ArtifactRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!repoId) return
    fetchArtifacts(repoId, 'diagram')
      .then(setArtifacts)
      .catch(() => setError(true))
  }, [repoId])

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 0,
          gap: 12,
          padding: 40,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Failed to load diagrams</span>
      </div>
    )
  }

  if (!artifacts) return null

  const roots = computeRootDiagrams(artifacts)
  const searchResults = searchDiagrams(artifacts, query)
  const visible: DiagramSummary[] = query.trim() ? searchResults : roots
  const byId = new Map(artifacts.map((a) => [a.id, a]))

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 28px 64px' }}>
        <div className="float-in">
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={13} />
            Repositories
          </Link>
          <h1
            style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: '10px 0 0' }}
          >
            Diagrams
          </h1>
          <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 13 }}>{repoId}</p>
        </div>

        <div className="search-input-wrap" style={{ marginTop: 20 }}>
          <Search size={16} className="search-input-icon" />
          <input
            type="search"
            className="search-input"
            aria-label="Search diagrams"
            placeholder="Search by id or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {visible.length > 0 ? (
          <div className="card-grid" style={{ marginTop: 24 }}>
            {visible.map((d) => {
              const artifact = byId.get(d.id)
              return artifact ? <DiagramCard key={d.id} repoId={repoId!} artifact={artifact} /> : null
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>No diagrams match your search.</p>
        )}
      </div>
    </div>
  )
}
