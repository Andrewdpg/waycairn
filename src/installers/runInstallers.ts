import type { AgentInstaller, InstallResult } from './types.js'
import { installers } from './registry.js'

export interface AgentInstallReport {
  agent: string
  mcpServer: InstallResult
  skill: InstallResult
  sessionHook: InstallResult
}

export function runInstallers(repoRoot: string, agentInstallers: AgentInstaller[] = installers): AgentInstallReport[] {
  const reports: AgentInstallReport[] = []
  for (const installer of agentInstallers) {
    if (!installer.detect()) continue
    reports.push({
      agent: installer.name,
      mcpServer: installer.installMcpServer(repoRoot),
      skill: installer.installSkill(repoRoot),
      sessionHook: installer.installSessionHook(repoRoot),
    })
  }
  return reports
}
