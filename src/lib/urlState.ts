export function readParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function updateParams(patch: Record<string, string | null>): void {
  const params = readParams();
  for (const [key, val] of Object.entries(patch)) {
    val === null ? params.delete(key) : params.set(key, val);
  }
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

export function pushParams(patch: Record<string, string | null>): void {
  const params = readParams();
  for (const [key, val] of Object.entries(patch)) {
    val === null ? params.delete(key) : params.set(key, val);
  }
  const qs = params.toString();
  history.pushState(null, "", qs ? `?${qs}` : location.pathname);
}
