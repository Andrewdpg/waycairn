import express, { type Express } from 'express'
import { join, resolve } from 'node:path'
import { readRegistry, type Registry } from './registry.js'
import { listArtifactsTool } from './tools/listArtifacts.js'
import { getArtifactTool } from './tools/getArtifact.js'
import { listRepos } from './tools/listRepos.js'

function resolveRegisteredRepoDir(registryPath: string, repoId: string): string | null {
  const registry = readRegistry(registryPath)
  const entry = registry[repoId]
  if (!entry) return null
  return join(entry.path, '.waycairn')
}

// listRepos(cwd) is a plain directory scan — it has no idea which of those
// siblings are also registered, and MCP's list_repos tool wants it that
// way (an agent can target ANY local sibling via repoPath, registered or
// not). The UI's "local" section is presented as "not yet registered"
// though, so here — and only here — local entries already covered by a
// registered path are dropped, or every registered repo would show up
// twice: once as a clickable "registered" entry, once as a non-clickable
// "not registered" one.
function localOnly(cwd: string, registry: Registry): string[] {
  const registeredPaths = new Set(Object.values(registry).map((entry) => resolve(entry.path)))
  return listRepos(cwd).filter((name) => !registeredPaths.has(resolve(cwd, name)))
}

export function createUiServer(cwd: string, registryPath: string, staticDir: string): Express {
  const app = express()

  app.get('/api/repos', (_req, res) => {
    const registered = readRegistry(registryPath)
    res.json({ local: localOnly(cwd, registered), registered })
  })

  app.get('/api/repos/:repoId/artifacts', (req, res) => {
    const waycairnDir = resolveRegisteredRepoDir(registryPath, req.params.repoId)
    if (!waycairnDir) {
      res.status(404).json({ error: `repoId ${JSON.stringify(req.params.repoId)} is not registered` })
      return
    }
    const kind = typeof req.query.kind === 'string' ? req.query.kind : 'diagram'
    res.json(listArtifactsTool(waycairnDir, kind))
  })

  app.get('/api/repos/:repoId/artifacts/:id', (req, res) => {
    const waycairnDir = resolveRegisteredRepoDir(registryPath, req.params.repoId)
    if (!waycairnDir) {
      res.status(404).json({ error: `repoId ${JSON.stringify(req.params.repoId)} is not registered` })
      return
    }
    const kind = typeof req.query.kind === 'string' ? req.query.kind : 'diagram'
    const record = getArtifactTool(waycairnDir, kind, req.params.id)
    if (!record) {
      res.status(404).json({ error: `artifact ${JSON.stringify(req.params.id)} not found` })
      return
    }
    res.json(record)
  })

  app.use(express.static(staticDir))

  // React Router routes (/repos/:repoId, /repos/:repoId/diagrams/:diagramId,
  // ...) exist only client-side — the server has no matching file or route
  // for them. Without this, a direct load or refresh on one of those URLs
  // 404s instead of booting the SPA, which then takes over routing itself.
  // Scoped to non-/api paths so a genuinely unmatched API route still 404s
  // as itself rather than silently returning HTML.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'))
  })

  return app
}
