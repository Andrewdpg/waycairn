import { Boxes, Package, Component as ComponentIcon, Workflow, Server, Database, Braces, ExternalLink, Cable, Table2, type LucideIcon } from 'lucide-react'
import type { NodeKind } from './types'

export const NODE_KIND_ICONS: Record<NodeKind, LucideIcon> = {
  system: Boxes,
  container: Package,
  component: ComponentIcon,
  service: Workflow,
  server: Server,
  database: Database,
  class: Braces,
  external: ExternalLink,
  bridge: Cable,
  table: Table2,
}

export function getNodeKindIcon(kind: NodeKind): LucideIcon {
  return NODE_KIND_ICONS[kind]
}
