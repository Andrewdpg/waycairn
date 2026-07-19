// ui/src/components/DiagramScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchArtifact } from '../lib/apiClient'
import { resolveDiagramChain, DiagramNotFoundError, type ChainEntry } from '../lib/resolveDiagramChain'
import type { DiagramNodeData } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'
import { SidePanel, type Tab } from './SidePanel'

type Resolution =
  | { status: 'loading' }
  | { status: 'error'; notFoundId: string }
  | { status: 'ready'; chain: ChainEntry[] }

export function DiagramScreen() {
  const { repoId, diagramId } = useParams<{ repoId: string; diagramId: string }>()
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(() => (params['*'] ?? '').split('/').filter(Boolean), [params['*']])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('legend')
  const [resolution, setResolution] = useState<Resolution>({ status: 'loading' })

  useEffect(() => {
    if (!repoId || !diagramId) return
    setResolution({ status: 'loading' })
    resolveDiagramChain(diagramId, segments, (id) => fetchArtifact(repoId, id, 'diagram'))
      .then((chain) => setResolution({ status: 'ready', chain }))
      .catch((err) => {
        if (err instanceof DiagramNotFoundError) {
          setResolution({ status: 'error', notFoundId: err.diagramId })
        } else {
          throw err
        }
      })
  }, [repoId, diagramId, segments])

  if (resolution.status === 'loading') return null

  if (resolution.status === 'error') {
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
        <span style={{ fontSize: 15, fontWeight: 600 }}>Diagram not found</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
          {resolution.notFoundId}
        </span>
      </div>
    )
  }

  const { chain } = resolution
  const current = chain[chain.length - 1].diagram
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...chain.slice(1).map((c) => c.diagram.title)]
  const selectedNode = current.nodes.find((n: DiagramNodeData) => n.id === selectedNodeId) ?? null

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n: DiagramNodeData) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/repos/${encodeURIComponent(repoId!)}/diagrams/${encodeURIComponent(diagramId!)}/${[...segments, nodeId].join('/')}`)
  }

  function handleNodeDetailRequest(nodeId: string) {
    setSelectedNodeId(nodeId)
    setPanelCollapsed(false)
    setActiveTab('details')
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/repos/${encodeURIComponent(repoId!)}/diagrams/${encodeURIComponent(diagramId!)}/${segments.slice(0, index).join('/')}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 12, gap: 12, boxSizing: 'border-box' }}>
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
            <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
          </div>
          <DiagramCanvas
            nodes={positionedNodes}
            edges={current.edges}
            onNodeClick={handleNodeClick}
            onNodeDetailRequest={handleNodeDetailRequest}
          />
        </div>
        <SidePanel
          node={selectedNode}
          notation={current.notation ?? 'c4'}
          onCloseNode={() => setSelectedNodeId(null)}
          diagramJson={JSON.stringify(current, null, 2)}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  )
}
