import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRepos, fetchRepoGraph, type ReposResponse, type RepoGraphResponse } from '../lib/apiClient'
import { groupRepos, filterGroups, type RepoGroup } from '../lib/repoGrouping'
import { useBackStack } from '../lib/backStack'

function RepoGroupList({ registered, group }: { registered: ReposResponse['registered']; group: RepoGroup }) {
  return (
    <ul className="repo-list">
      {group.repoIds.map((repoId) => (
        <li key={repoId} className="repo-list-item">
          <Link to={`/repos/${encodeURIComponent(repoId)}`}>
            <strong>{registered[repoId].name}</strong>
            <div aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{repoId}</div>
          </Link>
        </li>
      ))}
    </ul>
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

  const groups = filterGroups(groupRepos(repos.registered, repoGraph.groups), repos.registered, query)

  return (
    <div style={{ padding: 28, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}>Repositories</h1>
      <input
        type="search"
        aria-label="Search repositories"
        placeholder="Search by id or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: 14,
          marginBottom: 20,
          boxSizing: 'border-box',
        }}
      />
      {Object.keys(repos.registered).length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          No repos registered yet — run <code>waycairn init</code> inside a repo to register it.
        </p>
      ) : groups.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No repositories match your search.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map((group) => (
            <div key={group.repoIds.join(',')}>
              {group.repoIds.length > 1 && (
                <h2
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    margin: '0 0 8px',
                  }}
                >
                  Connected
                </h2>
              )}
              <RepoGroupList registered={repos.registered} group={group} />
            </div>
          ))}
        </div>
      )}

      {repos.local.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Not registered</h2>
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Found a <code>.git</code> here, but not yet browsable — run <code>waycairn init</code> in these to add them.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {repos.local.map((path) => (
              <li key={path} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
                {path}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
