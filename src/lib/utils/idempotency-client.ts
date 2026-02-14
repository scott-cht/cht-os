export function createIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function postJsonWithIdempotency(
  url: string,
  payload: unknown,
  keyPrefix: string
): Promise<{ response: Response; idempotencyKey: string }> {
  const idempotencyKey = createIdempotencyKey(keyPrefix);
  const body = JSON.stringify(payload);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body,
      });
      return { response, idempotencyKey };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
