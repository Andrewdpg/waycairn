import { describe, it, expect } from 'vitest'
import { uniqueDeploymentPerComponent } from './uniqueDeploymentPerComponent.js'
import type { RuleContext, RepoGraph } from './types.js'

function ctx(overrides: Partial<RuleContext> & { deploymentOwner?: string | null }): RuleContext {
  const owner = overrides.deploymentOwner ?? null
  const graph: RepoGraph = { componentOf: () => new Set(), deploymentOwner: () => owner }
  return {
    kind: 'diagram',
    id: 'deployment',
    data: { nodes: [], edges: [] },
    repoId: 'host/org/a',
    graph: () => graph,
    ...overrides,
  }
}

describe('uniqueDeploymentPerComponent', () => {
  it('does nothing for a non-deployment diagram id', () => {
    expect(uniqueDeploymentPerComponent.check(ctx({ id: 'components', deploymentOwner: 'host/org/b' }))).toBeNull()
  })

  it('does nothing when repoId is null (repo not registered)', () => {
    expect(uniqueDeploymentPerComponent.check(ctx({ repoId: null, deploymentOwner: 'host/org/b' }))).toBeNull()
  })

  it('allows re-saving your own deployment (owner === self)', () => {
    expect(uniqueDeploymentPerComponent.check(ctx({ repoId: 'host/org/a', deploymentOwner: 'host/org/a' }))).toBeNull()
  })

  it('allows creating the first deployment in a component (owner === null)', () => {
    expect(uniqueDeploymentPerComponent.check(ctx({ deploymentOwner: null }))).toBeNull()
  })

  it('rejects when another repo in the component already owns deployment', () => {
    const message = uniqueDeploymentPerComponent.check(ctx({ repoId: 'host/org/a', deploymentOwner: 'host/org/b' }))
    expect(message).toMatch(/host\/org\/b/)
  })
})
