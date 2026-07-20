/** The waycairn mark: a stack of trail-marker stones — the signal you leave for whoever comes next. */
export function CairnMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <ellipse cx="16" cy="26" rx="11" ry="3.4" fill="var(--accent)" opacity="0.25" />
      <path d="M6.5 22.5c0-2 4.2-3.4 9.5-3.4s9.5 1.4 9.5 3.4-4.2 3-9.5 3-9.5-1-9.5-3Z" fill="var(--accent)" />
      <path
        d="M8.5 16.2c0-1.7 3.4-2.9 7.5-2.9s7.5 1.2 7.5 2.9-3.4 2.6-7.5 2.6-7.5-.9-7.5-2.6Z"
        fill="var(--accent)"
        opacity="0.85"
      />
      <path
        d="M10.5 10.6c0-1.4 2.5-2.4 5.5-2.4s5.5 1 5.5 2.4-2.5 2.2-5.5 2.2-5.5-.8-5.5-2.2Z"
        fill="var(--text)"
        opacity="0.9"
      />
      <ellipse cx="16" cy="5.4" rx="3.4" ry="1.8" fill="var(--text)" opacity="0.6" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CairnMark />
      way<span style={{ color: 'var(--accent)' }}>cairn</span>
    </span>
  )
}
