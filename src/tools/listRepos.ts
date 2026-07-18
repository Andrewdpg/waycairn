import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function isRepo(dir: string): boolean {
  return existsSync(join(dir, '.git')) // a worktree's .git is a file, not a directory — existsSync covers both
}

export function listRepos(cwd: string): string[] {
  const repoPaths: string[] = []

  if (isRepo(cwd)) repoPaths.push('.')

  for (const name of readdirSync(cwd)) {
    const entryPath = join(cwd, name)
    if (!statSync(entryPath).isDirectory()) continue
    if (isRepo(entryPath)) repoPaths.push(name)
  }

  return repoPaths.sort()
}
