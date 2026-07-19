import type { DiagramRule } from './types.js'

export const uniqueDeploymentPerComponent: DiagramRule = {
  name: 'uniqueDeploymentPerComponent',
  check(ctx) {
    if (ctx.id !== 'deployment' || ctx.repoId === null) return null
    const owner = ctx.graph().deploymentOwner(ctx.repoId)
    if (owner !== null && owner !== ctx.repoId) {
      return `repo ${JSON.stringify(owner)} already owns the "deployment" diagram in this dependency graph — only one is allowed per connected set of repos`
    }
    return null
  },
}
