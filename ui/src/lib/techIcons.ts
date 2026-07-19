import { siGo, siReact, siTypescript, siJavascript, siPostgresql, siMysql, siDocker, siNodedotjs, siPython } from 'simple-icons'

export interface TechIcon {
  label: string
  short: string
  fg: string
  bg: string
  path?: string
}

const TECH_ICONS: Record<string, TechIcon> = {
  go: { label: 'Go', short: 'Go', fg: '#00ADD8', bg: '#0b2b30', path: siGo.path },
  react: { label: 'React', short: 'Re', fg: '#61DAFB', bg: '#0b2a30', path: siReact.path },
  typescript: { label: 'TypeScript', short: 'TS', fg: '#3178C6', bg: '#0e1f33', path: siTypescript.path },
  javascript: { label: 'JavaScript', short: 'JS', fg: '#F7DF1E', bg: '#332f0e', path: siJavascript.path },
  postgresql: { label: 'PostgreSQL', short: 'Pg', fg: '#4169E1', bg: '#101a33', path: siPostgresql.path },
  mysql: { label: 'MySQL', short: 'My', fg: '#4479A1', bg: '#101c26', path: siMysql.path },
  // ponytail: simple-icons has no AWS mark (no square/wordmark-free glyph in
  // their set) — falls back to the plain monogram badge below.
  aws: { label: 'AWS', short: 'AWS', fg: '#FF9900', bg: '#2e2109' },
  docker: { label: 'Docker', short: 'Do', fg: '#2496ED', bg: '#0c2436', path: siDocker.path },
  nodejs: { label: 'Node.js', short: 'Nd', fg: '#5FA04E', bg: '#132211', path: siNodedotjs.path },
  python: { label: 'Python', short: 'Py', fg: '#3776AB', bg: '#0f1d2e', path: siPython.path },
}

const FALLBACK_ICON: TechIcon = { label: 'Unknown tech', short: '?', fg: '#9096a8', bg: '#23252c' }

export function getTechIcon(id: string): TechIcon {
  return TECH_ICONS[id.toLowerCase()] ?? FALLBACK_ICON
}
