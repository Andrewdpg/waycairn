import { useEffect, useState } from 'react'
import { Search, Waypoints } from 'lucide-react'
import { fetchRepos, fetchRepoGraph, type ReposResponse, type RepoGraphResponse } from '../lib/apiClient'
import { groupRepos, filterGroups, type RepoGroup } from '../lib/repoGrouping'
import { useBackStack } from '../lib/backStack'
import { RepoCard, UnregisteredRepoCard } from './RepoCard'

function RepoGroupGrid({ registered, group }: { registered: ReposResponse['registered']; group: RepoGroup }) {
  return (
    <div className="card-grid">
      {group.repoIds.map((repoId) => (
        <RepoCard key={repoId} repo={{ id: repoId, name: registered[repoId].name, path: registered[repoId].path }} />
      ))}
    </div>
  )
}

export function RepoPicker() {
  const [repos, setRepos] = useState<ReposResponse | null>(null)
  const [repoGraph, setRepoGraph] = useState<RepoGraphResponse | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState(false)
  const { clear } = useBackStack()

  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    Promise.all([fetchRepos(), fetchRepoGraph()])
      .then(([reposResult, graphResult]) => {
        setRepos(reposResult)
        setRepoGraph(graphResult)
      })
      .catch(() => setError(true))
  }, [])

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
        <span style={{ fontSize: 15, fontWeight: 600 }}>Failed to load repositories</span>
      </div>
    )
  }

  if (!repos || !repoGraph) return null

  const registeredCount = Object.keys(repos.registered).length
  const groups = filterGroups(groupRepos(repos.registered, repoGraph.groups), repos.registered, query)
  const connected = groups.filter((g) => g.repoIds.length > 1)
  const standalone = groups.filter((g) => g.repoIds.length === 1)
  const q = query.trim().toLowerCase()
  const localMatches = repos.local.filter((path) => !q || path.toLowerCase().includes(q))

  return (
    <div className="topo-grid" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 28px 64px' }}>
        <div className="float-in">
          <span className="pill">
            <span className="pill-dot" />
            {registeredCount} repo{registeredCount === 1 ? '' : 's'} registered
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', margin: '14px 0 0' }}>
            Repositories
          </h1>
          <p style={{ maxWidth: 520, marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Pick a repository to explore its diagrams. Repos linked to each other through cross-repo references are
            grouped as connected estates.
          </p>
        </div>

        <div className="search-input-wrap" style={{ marginTop: 28 }}>
          <Search size={16} className="search-input-icon" />
          <input
            type="search"
            className="search-input"
            aria-label="Search repositories"
            placeholder="Search by id or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {registeredCount === 0 && repos.local.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>
            No repos registered yet — run <code>waycairn init</code> inside a repo to register it.
          </p>
        ) : (
          <>
            {connected.map((group) => (
              <section key={group.repoIds.join(',')} style={{ marginTop: 32 }}>
                <div className="section-heading">
                  <Waypoints size={14} color="var(--accent-secondary)" />
                  <h2>Connected</h2>
                  <span className="badge">{group.repoIds.length} repos</span>
                  <div className="section-heading-rule" />
                </div>
                <RepoGroupGrid registered={repos.registered} group={group} />
              </section>
            ))}

            {standalone.length > 0 && (
              <section style={{ marginTop: 32 }}>
                <div className="section-heading">
                  <h2>Standalone</h2>
                  <div className="section-heading-rule" />
                </div>
                <div className="card-grid">
                  {standalone.flatMap((g) => g.repoIds).map((repoId) => (
                    <RepoCard key={repoId} repo={{ id: repoId, name: repos.registered[repoId].name, path: repos.registered[repoId].path }} />
                  ))}
                </div>
              </section>
            )}

            {groups.length === 0 && localMatches.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>No repositories match your search.</p>
            )}
          </>
        )}

        {localMatches.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <div className="section-heading">
              <h2 style={{ color: 'var(--text-muted)' }}>Not registered</h2>
              <div className="section-heading-rule" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 12px' }}>
              Found a <code>.git</code> here, but not yet browsable — run <code>waycairn init</code> in these to add them.
            </p>
            <div className="card-grid">
              {localMatches.map((path) => (
                <UnregisteredRepoCard key={path} path={path} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
