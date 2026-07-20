import { useState } from 'react'
import type { DiagramNodeData, Notation, SourceRef } from '../lib/types'
import { getTechIcon } from '../lib/techIcons'
import { TechBadge } from './TechBadge'
import { openFile } from '../lib/apiClient'

export interface DiagramDetailPanelProps {
  node: DiagramNodeData | null
  notation: Notation
  onClose: () => void
  repoId: string
}

const sectionHeadingStyle = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
  color: 'var(--text-faint)',
}

function sourceRefLabel(ref: string | SourceRef): string {
  return typeof ref === 'string' ? ref : ref.path
}

// Prop is named `sourceRef`, not `ref` — React intercepts a prop literally
// named `ref` on JSX elements for ref-forwarding, so a plain function
// component would never actually receive it as a normal prop.
function SourceRefItem({ repoId, sourceRef }: { repoId: string; sourceRef: string | SourceRef }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    setPending(true)
    setError(null)
    try {
      await openFile(repoId, sourceRef)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <li style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <button
        onClick={handleClick}
        disabled={pending}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {sourceRefLabel(sourceRef)}
      </button>
      {error && <div style={{ color: 'var(--danger, #d33)' }}>{error}</div>}
    </li>
  )
}

export function DiagramDetailPanel({ node, notation, onClose, repoId }: DiagramDetailPanelProps) {
  if (!node) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click a node's eye icon to see its details here.</p>
  }

  const showClassMembers =
    (node.kind === 'class' && notation === 'uml-structural') || (node.kind === 'table' && notation === 'erd')

  return (
    <div>
      <button
        className="icon-btn"
        aria-label="Close details"
        onClick={onClose}
        style={{ float: 'right', border: 'none', fontSize: 14, padding: 4 }}
      >
        ✕
      </button>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>{node.label}</h2>
      {node.responsibility && <p>{node.responsibility}</p>}

      {node.techStack && node.techStack.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Tech stack</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {node.techStack.map((id) => {
              const icon = getTechIcon(id)
              return (
                <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TechBadge icon={icon} />
                  {icon.label}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {node.dataOwned && (
        <section>
          <h3 style={sectionHeadingStyle}>Data owned</h3>
          <p>{node.dataOwned}</p>
        </section>
      )}

      {node.gotchas && node.gotchas.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Gotchas</h3>
          <ul>
            {node.gotchas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.attributes && node.attributes.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Attributes</h3>
          <ul>
            {node.attributes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.operations && node.operations.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Operations</h3>
          <ul>
            {node.operations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      {node.sourceRefs && node.sourceRefs.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Source</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {node.sourceRefs.map((ref, i) => (
              <SourceRefItem key={i} repoId={repoId} sourceRef={ref} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
