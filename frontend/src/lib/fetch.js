export const AUTH_TIMEOUT_MS = 10000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Forespørselen tok for lang tid');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
