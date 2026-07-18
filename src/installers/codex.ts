import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { parse, stringify } from 'smol-toml'
import type { AgentInstaller, InstallResult } from './types.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'
import { WAYCAIRN_NUDGE } from './sharedContent.js'

export function detectCodex(homeDir: string = homedir()): boolean {
  return existsSync(join(homeDir, '.codex'))
}

function installMcpServer(repoRoot: string): InstallResult {
  const path = join(repoRoot, '.codex', 'config.toml')
  const config = existsSync(path) ? (parse(readFileSync(path, 'utf8')) as Record<string, unknown>) : {}
  const mcpServers = (config.mcp_servers as Record<string, unknown> | undefined) ?? {}
  mcpServers.waycairn = { command: 'waycairn', args: ['mcp'] }
  config.mcp_servers = mcpServers
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stringify(config), 'utf8')
  return { installed: true, detail: `wrote ${path}` }
}

function installSkill(_repoRoot: string): InstallResult {
  return { installed: false, detail: 'Codex has no skill concept' }
}

interface CodexHooks {
  hooks?: { Stop?: Array<{ hooks: Array<{ type: string; command: string }> }> }
}

function installSessionHook(repoRoot: string): InstallResult {
  const path = join(repoRoot, '.codex', 'hooks.json')
  const hooksFile = readJsonFile(path) as CodexHooks
  hooksFile.hooks = hooksFile.hooks ?? {}
  hooksFile.hooks.Stop = hooksFile.hooks.Stop ?? []
  const alreadyPresent = hooksFile.hooks.Stop.some((matcher) =>
    matcher.hooks.some((hook) => hook.command === WAYCAIRN_NUDGE)
  )
  if (!alreadyPresent) {
    hooksFile.hooks.Stop.push({ hooks: [{ type: 'command', command: WAYCAIRN_NUDGE }] })
  }
  writeJsonFile(path, hooksFile as unknown as Record<string, unknown>)
  return {
    installed: true,
    detail: `wrote ${path} (only fires once you trust this project in Codex)`,
  }
}

export const codexInstaller: AgentInstaller = {
  name: 'codex',
  detect: () => detectCodex(),
  installMcpServer,
  installSkill,
  installSessionHook,
}
