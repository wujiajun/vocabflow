export interface BackTarget {
  path: string
  label: string
}

// A page that links to a detail page passes where the user came from, so the detail page's back
// link returns them to the same place (for example page 3 of a list) instead of a fixed default.
export function backState(path: string, label: string) {
  return { backTo: { path, label } }
}

export function readBackTarget(state: unknown, fallback: BackTarget): BackTarget {
  if (typeof state !== 'object' || state === null || !('backTo' in state)) {
    return fallback
  }

  const { path, label } = (state.backTo ?? {}) as Partial<BackTarget>
  // History state can be edited, so only accept in-app paths.
  return typeof path === 'string' && path.startsWith('/app/') && typeof label === 'string' ? { path, label } : fallback
}
