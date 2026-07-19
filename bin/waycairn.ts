#!/usr/bin/env node
// bin/waycairn.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createLocalMcpServer } from '../src/localServer.js'
import { runInit } from '../src/commands/init.js'
import { createUiServer } from '../src/uiServer.js'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const subcommand = process.argv[2]

if (subcommand === 'init') {
  try {
    runInit(process.cwd())
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
  const staticDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'dist')
  const port = Number(process.env.WAYCAIRN_UI_PORT) || 4317
  const app = createUiServer(process.cwd(), registryPath, staticDir)
  app.listen(port, () => {
    console.log(`waycairn ui: http://localhost:${port}`)
  })
} else {
  console.error(`Unknown or missing subcommand: ${JSON.stringify(subcommand)}. Usage: waycairn <init|mcp|ui>`)
  process.exit(1)
}
