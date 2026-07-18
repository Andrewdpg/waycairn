import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WAYCAIRN_GITIGNORE_BLOCK =
  '\n# waycairn\'s derived sqlite index — a binary git can\'t merge; the .json\n' +
  '# artifact files under .waycairn/<kind>/ are the versioned source of truth\n' +
  '.waycairn/index.sqlite\n'

export function ensureGitignoreEntry(repoRoot: string): void {
  const path = join(repoRoot, '.gitignore')
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  if (existing.includes('.waycairn/index.sqlite')) return
  const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n')
  writeFileSync(path, existing + (needsLeadingNewline ? '\n' : '') + WAYCAIRN_GITIGNORE_BLOCK, 'utf8')
}
