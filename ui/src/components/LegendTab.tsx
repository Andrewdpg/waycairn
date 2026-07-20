import { NODE_KINDS } from '../lib/types'
import { NODE_SHAPES } from './nodeShapes'

const headingStyle = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
  color: 'var(--text-faint)',
}

const EDGE_LEGEND: Array<{ sample: string; label: string; description: string }> = [
  { sample: '───────▶', label: 'Association', description: 'Plain line — a general relationship or call. The default when no relationship is set.' },
  { sample: '───◆───▶', label: 'Composition', description: 'Filled diamond — the target is a part owned by the source (uml-structural notation).' },
  { sample: '───▷───▷', label: 'Inheritance', description: 'Hollow triangle — the source is a subtype of the target (uml-structural notation).' },
  { sample: '- - - -▶', label: 'Dependency', description: 'Dashed line, no arrowhead — a loose/indirect dependency (uml-structural notation).' },
  { sample: '- - - -▶', label: 'Async step', description: 'Dashed line — an asynchronous step in a uml-behavioral flow (edge has "async": true).' },
]

export function LegendTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section>
        <h3 style={headingStyle}>Node shapes</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {NODE_KINDS.map((kind) => {
            const Shape = NODE_SHAPES[kind]
            return (
              <div key={kind} style={{ transform: 'scale(0.8)', transformOrigin: 'left top' }}>
                <Shape node={{ id: kind, label: kind, kind }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{kind}</span>
                </Shape>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 style={headingStyle}>Edge lines</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {EDGE_LEGEND.map((e) => (
            <li key={e.label}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                {e.sample} <strong>{e.label}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.description}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={headingStyle}>Edge labels</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Format: <code>order. label [condition]</code> — e.g. "1. on success [credentials valid]". The leading
          number is step order in a flow, the bracketed text is a guard condition; both are optional.
        </p>
      </section>

      <section>
        <h3 style={headingStyle}>Eye icon</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Click the 👁 in a node's corner to open its full write-up (responsibility, tech stack, data owned,
          gotchas) in the Details tab.
        </p>
      </section>
    </div>
  )
}
