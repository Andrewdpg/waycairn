export interface InstallResult {
  installed: boolean
  detail: string
}

export interface AgentInstaller {
  name: string
  detect(): boolean
  installMcpServer(repoRoot: string): InstallResult
  installSkill(repoRoot: string): InstallResult
  installSessionHook(repoRoot: string): InstallResult
}
