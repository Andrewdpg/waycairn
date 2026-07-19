import type { UmlRelationship } from '../lib/types'

export const RELATIONSHIP_MARKER_IDS: Record<UmlRelationship, string | undefined> = {
  association: undefined,
  composition: 'uml-composition',
  inheritance: 'uml-inheritance',
  dependency: undefined,
}

export function UmlMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <marker
          id="uml-composition"
          viewBox="0 0 20 10"
          refX="18"
          refY="5"
          markerWidth="16"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 5 L9 0 L18 5 L9 10 Z" fill="var(--kind-component-fg, #d6b0e0)" />
        </marker>
        <marker
          id="uml-inheritance"
          viewBox="0 0 20 14"
          refX="18"
          refY="7"
          markerWidth="18"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L18 7 L0 14 Z" fill="none" stroke="var(--kind-component-fg, #d6b0e0)" strokeWidth="1.5" />
        </marker>
      </defs>
    </svg>
  )
}
