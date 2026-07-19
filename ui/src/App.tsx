import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { RepoPicker } from './components/RepoPicker'
import { RootDiagramsScreen } from './components/RootDiagramsScreen'
import { DiagramScreen } from './components/DiagramScreen'

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="app-header-brand">
            waycairn
          </Link>
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<RepoPicker />} />
            <Route path="/repos/:repoId" element={<RootDiagramsScreen />} />
            <Route path="/repos/:repoId/diagrams/:diagramId/*" element={<DiagramScreen />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
