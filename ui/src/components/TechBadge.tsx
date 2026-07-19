import type { TechIcon } from '../lib/techIcons'

export interface TechBadgeProps {
  icon: TechIcon
  size?: number
}

export function TechBadge({ icon, size = 16 }: TechBadgeProps) {
  return (
    <span
      title={icon.label}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: icon.bg,
        color: icon.fg,
        fontSize: size * 0.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon.path ? (
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill={icon.fg} aria-hidden="true">
          <path d={icon.path} />
        </svg>
      ) : (
        icon.short
      )}
    </span>
  )
}
