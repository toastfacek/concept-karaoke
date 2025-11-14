/**
 * Fetches a URL with automatic retry and exponential backoff
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, body, etc.)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<Response>
 *
 * Retry behavior:
 * - Retries on network errors (fetch throws)
 * - Retries on 5xx server errors
 * - Does NOT retry on 4xx client errors (bad request, not found, etc.)
 * - Exponential backoff: 100ms, 200ms, 400ms
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Don't retry client errors (4xx), only server errors (5xx)
      if (response.ok || response.status < 500) {
        return response
      }

      console.warn(
        `[fetchWithRetry] Server error (${response.status}), retrying... (${attempt + 1}/${maxRetries})`
      )
    } catch (error) {
      // Network error or fetch threw
      if (attempt === maxRetries - 1) {
        // Last attempt failed, throw the error
        throw error
      }

      console.warn(
        `[fetchWithRetry] Network error, retrying... (${attempt + 1}/${maxRetries})`,
        error
      )
    }

    // Exponential backoff: 100ms, 200ms, 400ms
    const delayMs = 100 * Math.pow(2, attempt)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`[fetchWithRetry] Max retries (${maxRetries}) exceeded for ${url}`)
}
