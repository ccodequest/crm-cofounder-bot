const requestLog = new Map<number, number[]>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function checkRateLimit(chatId: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const timestamps = requestLog.get(chatId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  requestLog.set(chatId, recent);
  return { allowed: true, retryAfter: 0 };
}
