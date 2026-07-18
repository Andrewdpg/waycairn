import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createLocalMcpServer } from './localServer.js'

let waycairnDir: string
let client: Client

beforeEach(async () => {
  waycairnDir = mkdtempSync(join(tmpdir(), 'waycairn-server-'))
  const server = createLocalMcpServer(waycairnDir)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(clientTransport)
})

afterEach(() => {
  rmSync(waycairnDir, { recursive: true, force: true })
})

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text: string }>
  return content[0].text
}

describe('createLocalMcpServer', () => {
  it('exposes all four generic artifact tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['get_artifact', 'list_artifacts', 'upsert_artifact', 'validate_artifact'])
  })

  it('round-trips an artifact through upsert_artifact then get_artifact', async () => {
    await client.callTool({
      name: 'upsert_artifact',
      arguments: { kind: 'diagram', id: 'a', data: { nodes: [], edges: [] } },
    })
    const result = await client.callTool({ name: 'get_artifact', arguments: { kind: 'diagram', id: 'a' } })
    expect(JSON.parse(textOf(result))).toMatchObject({ id: 'a', kind: 'diagram' })
  })

  it('list_artifacts reflects what upsert_artifact wrote', async () => {
    await client.callTool({
      name: 'upsert_artifact',
      arguments: { kind: 'diagram', id: 'a', data: { nodes: [], edges: [] } },
    })
    const result = await client.callTool({ name: 'list_artifacts', arguments: { kind: 'diagram' } })
    const records = JSON.parse(textOf(result)) as Array<{ id: string }>
    expect(records.map((r) => r.id)).toEqual(['a'])
  })

  it('validate_artifact reports invalid data without writing it', async () => {
    const result = await client.callTool({
      name: 'validate_artifact',
      arguments: { kind: 'diagram', data: { nodes: [{ id: 'a' }], edges: [] } },
    })
    expect(JSON.parse(textOf(result))).toMatchObject({ valid: false })
    const getResult = await client.callTool({ name: 'get_artifact', arguments: { kind: 'diagram', id: 'a' } })
    expect(textOf(getResult)).toBe('not found')
  })
})
