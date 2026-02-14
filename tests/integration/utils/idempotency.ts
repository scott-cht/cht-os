import { expect, type APIResponse } from '@playwright/test';

export function makeIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeUniqueText(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function expectIdempotencyReplay(
  first: APIResponse,
  second: APIResponse
): Promise<void> {
  const firstBody = await first.json();
  const secondBody = await second.json();
  expect(second.status()).toBe(first.status());
  expect(secondBody).toEqual(firstBody);
  expect(second.headers()['idempotency-replayed']).toBe('true');
}

export async function expectIdempotencyConflict(
  response: APIResponse,
  messageFragment: string
): Promise<void> {
  const body = await response.json();
  expect(response.status()).toBe(409);
  expect(body.error?.message ?? body.error ?? '').toContain(messageFragment);
}
