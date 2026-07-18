// claudeCode.ts and codex.ts wrap this in single quotes to build a shell
// command (`echo '${WAYCAIRN_NUDGE}' >&2`) — keep it free of single quotes,
// or escape them at the call sites if the text ever needs one.
export const WAYCAIRN_NUDGE =
  'waycairn: did you touch a documented component? Update .waycairn/ before finishing.'
