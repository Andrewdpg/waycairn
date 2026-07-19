#!/usr/bin/env node
// bin/waycairn.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createLocalMcpServer } from '../src/localServer.js'
import { runInit, runInitWorkspace } from '../src/commands/init.js'
import { createUiServer } from '../src/uiServer.js'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// This file runs from two different locations depending on how it's
// invoked: directly as bin/waycairn.ts via tsx in dev, or as compiled
// dist/bin/waycairn.js in a published package — one directory deeper
// relative to ui/dist, which ships as a sibling of dist/. Trying the dev
// layout first (and falling back to the published one) avoids needing two
// separate code paths or a build-time constant.
function resolveUiDistDir(scriptDir: string): string {
  const devPath = join(scriptDir, '..', 'ui', 'dist')
  if (existsSync(devPath)) return devPath
  return join(scriptDir, '..', '..', 'ui', 'dist')
}

const HELP_TEXT = `waycairn <command> [options]

Commands:
  init               Register this repo and install agent integrations (requires a git remote)
  init --workspace   Install agent integrations for a parent folder of several sibling repos, without registering it as a repo
  mcp                Start the stdio MCP server (what an agent's config launches)
  ui                 Start a local, read-only web UI for browsing diagrams (http://localhost:4317, override with WAYCAIRN_UI_PORT)

Options:
  -h, --help         Show this help
`

const subcommand = process.argv[2]

if (subcommand === '-h' || subcommand === '--help') {
  console.log(HELP_TEXT)
} else if (subcommand === 'init') {
  try {
    if (process.argv[3] === '--workspace') {
      runInitWorkspace(process.cwd())
    } else {
      runInit(process.cwd())
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
} else if (subcommand === 'mcp') {
  const server = createLocalMcpServer(process.cwd())
  const transport = new StdioServerTransport()
  await server.connect(transport)
} else if (subcommand === 'ui') {
  const registryPath = join(homedir(), '.waycairn', 'registry.json')
  const staticDir = resolveUiDistDir(dirname(fileURLToPath(import.meta.url)))
  const port = Number(process.env.WAYCAIRN_UI_PORT) || 4317
  const app = createUiServer(process.cwd(), registryPath, staticDir)
  // Bind to loopback only — this API has no auth and returns registered
  // repos' absolute filesystem paths and diagram content; binding to all
  // interfaces (the default with no host argument) would expose that to
  // anyone else on the same network.
  app.listen(port, '127.0.0.1', () => {
    console.log(`waycairn ui: http://localhost:${port}`)
  })
} else {
  console.error(`Unknown or missing subcommand: ${JSON.stringify(subcommand)}. Usage: waycairn <init|mcp|ui>`)
  process.exit(1)
}
