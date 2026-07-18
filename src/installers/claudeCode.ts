import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { AgentInstaller, InstallResult } from './types.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'
import { WAYCAIRN_NUDGE } from './sharedContent.js'

const SKILL_MD = `---
name: waycairn
description: Use after resolving a bug, finishing a non-trivial task, or learning something non-obvious about a documented component in this repo — keeps the repo's waycairn documentation (diagrams, gotchas, pending issues) in sync with what actually changed.
---

# waycairn — keep the docs honest

This repo has waycairn artifact storage (\`.waycairn/\`) with an MCP server
exposing \`list_artifacts\`, \`get_artifact\`, \`upsert_artifact\`,
\`validate_artifact\`, \`list_repos\`.

## When to update

- You fixed a bug whose root cause wasn't obvious from the code alone →
  \`upsert_artifact\` the affected component's diagram node, adding a
  \`gotchas\` entry describing the trap.
- You resolved a gotcha that was already documented → remove it from the
  node's \`gotchas\` array instead of leaving stale information.
- You learned something about a component's responsibility, tech stack, or
  data ownership that isn't already captured → update the relevant fields.
- You finished a task that leaves a real pending concern for later → add
  it as a \`gotchas\` entry, phrased as a warning to the next person (or
  agent) touching that code.

## How

1. \`list_artifacts({ kind: "diagram" })\` to find the component you
   touched — do not guess an id.
2. \`get_artifact({ kind: "diagram", id })\` to see its current state before
   editing.
3. \`upsert_artifact({ kind: "diagram", id, data })\` with the full updated
   \`data\` (nodes/edges) — this replaces the whole artifact, not a patch.

Do not invent a new component or diagram just to log a note — only update
an artifact that already exists and genuinely describes what you touched.
If nothing documented was affected, don't force an update.
`

export function detectClaudeCode(homeDir: string = homedir()): boolean {
  return existsSync(join(homeDir, '.claude'))
}

function installMcpServer(repoRoot: string): InstallResult {
  const path = join(repoRoot, '.mcp.json')
  const config = readJsonFile(path) as { mcpServers?: Record<string, unknown> }
  config.mcpServers = config.mcpServers ?? {}
  config.mcpServers.waycairn = { type: 'stdio', command: 'waycairn', args: ['mcp'] }
  writeJsonFile(path, config)
  return { installed: true, detail: `wrote ${path}` }
}

function installSkill(repoRoot: string): InstallResult {
  const path = join(repoRoot, '.claude', 'skills', 'waycairn', 'SKILL.md')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, SKILL_MD, 'utf8')
  return { installed: true, detail: `wrote ${path}` }
}

interface ClaudeSettings {
  hooks?: { Stop?: Array<{ hooks: Array<{ type: string; command: string }> }> }
}

function installSessionHook(repoRoot: string): InstallResult {
  const path = join(repoRoot, '.claude', 'settings.json')
  const settings = readJsonFile(path) as ClaudeSettings
  settings.hooks = settings.hooks ?? {}
  settings.hooks.Stop = settings.hooks.Stop ?? []
  const alreadyPresent = settings.hooks.Stop.some((matcher) =>
    matcher.hooks.some((hook) => hook.command === WAYCAIRN_NUDGE)
  )
  if (!alreadyPresent) {
    settings.hooks.Stop.push({ hooks: [{ type: 'command', command: WAYCAIRN_NUDGE }] })
  }
  writeJsonFile(path, settings as unknown as Record<string, unknown>)
  return { installed: true, detail: `wrote ${path}` }
}

export const claudeCodeInstaller: AgentInstaller = {
  name: 'claude-code',
  detect: () => detectClaudeCode(),
  installMcpServer,
  installSkill,
  installSessionHook,
}
