/**
 * Network error detection utility.
 * Distinguishes offline and transient connectivity drops from actual server / auth errors.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true

  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)

  const lower = message.toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    lower.includes('offline') ||
    lower.includes('abort') ||
    lower.includes('load failed') ||
    lower.includes('connection refused') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  )
}
