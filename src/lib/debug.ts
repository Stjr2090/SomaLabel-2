/**
 * Debug-mode gate: true only when the URL has ?debug=1
 * or NODE_ENV is development (Vite DEV).
 */
export function isDebugMode(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') return true;
    }
  } catch {
    // ignore URL parsing errors
  }
  try {
    const viteDev =
      typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    if (viteDev) return true;
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
