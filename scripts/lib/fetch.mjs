// fetchHtml dengan retry + backoff eksponensial + hormat Retry-After.
// retries = jumlah percobaan ulang SETELAH percobaan awal (total = retries+1).
export async function fetchHtml(url, opts = {}) {
  const { retries = 3, timeoutMs = 30000, backoffMs = 1000, fetchFn = globalThis.fetch } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        const retryAfter = res.headers?.get?.('retry-after');
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs * 2 ** attempt;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
  }
  throw new Error(`fetch failed after ${retries + 1} attempts for ${url}: ${lastErr?.message || lastErr}`);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomDelay(minMs = 1000, maxMs = 2000) {
  return minMs + Math.random() * (maxMs - minMs);
}
