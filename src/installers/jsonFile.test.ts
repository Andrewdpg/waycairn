import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJsonFile, writeJsonFile } from './jsonFile.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'waycairn-jsonfile-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('jsonFile', () => {
  it('readJsonFile returns {} for a missing file', () => {
    expect(readJsonFile(join(dir, 'missing.json'))).toEqual({})
  })

  it('writeJsonFile creates parent directories and the file is readable back', () => {
    const path = join(dir, 'nested', 'config.json')
    writeJsonFile(path, { a: 1 })
    expect(readJsonFile(path)).toEqual({ a: 1 })
  })

  it('writeJsonFile overwrites prior content at the same path', () => {
    const path = join(dir, 'config.json')
    writeJsonFile(path, { a: 1 })
    writeJsonFile(path, { a: 2, b: 3 })
    expect(readJsonFile(path)).toEqual({ a: 2, b: 3 })
  })
})
