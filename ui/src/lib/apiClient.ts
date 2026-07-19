export interface RegistryEntry {
  path: string
  name: string
}

export type Registry = Record<string, RegistryEntry>

export interface ReposResponse {
  local: string[]
  registered: Registry
}

export interface ArtifactRecord {
  id: string
  kind: string
  updatedAt: string
  data: unknown
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchRepos(): Promise<ReposResponse> {
  return getJson<ReposResponse>('/api/repos')
}

export async function fetchArtifacts(repoId: string, kind = 'diagram'): Promise<ArtifactRecord[]> {
  const encodedRepoId = encodeURIComponent(repoId)
  return getJson<ArtifactRecord[]>(`/api/repos/${encodedRepoId}/artifacts?kind=${encodeURIComponent(kind)}`)
}

export async function fetchArtifact(repoId: string, id: string, kind = 'diagram'): Promise<ArtifactRecord | null> {
  const encodedRepoId = encodeURIComponent(repoId)
  const encodedId = encodeURIComponent(id)
  const url = `/api/repos/${encodedRepoId}/artifacts/${encodedId}?kind=${encodeURIComponent(kind)}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`)
  }
  return (await res.json()) as ArtifactRecord
}

export interface RepoGraphResponse {
  groups: string[][]
}

export async function fetchRepoGraph(): Promise<RepoGraphResponse> {
  return getJson<RepoGraphResponse>('/api/repo-graph')
}
