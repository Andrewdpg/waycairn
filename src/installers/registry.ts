// src/installers/registry.ts
import type { AgentInstaller } from './types.js'
import { claudeCodeInstaller } from './claudeCode.js'
import { codexInstaller } from './codex.js'
import { opencodeInstaller } from './opencode.js'

// Adding an agent later: implement AgentInstaller in its own file next to
// this one, push it into this array. Nothing in runInstallers.ts or
// commands/init.ts changes.
export const installers: AgentInstaller[] = [claudeCodeInstaller, codexInstaller, opencodeInstaller]
