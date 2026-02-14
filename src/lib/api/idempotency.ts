import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

type IdempotencyState = 'in_progress' | 'completed' | 'failed';

interface IdempotencyRecord {
  id: string;
  endpoint: string;
  idempotency_key: string;
  request_hash: string;
  state: IdempotencyState;
  status_code: number | null;
  response_body: unknown;
  locked_until: string;
}

export type IdempotencyAcquireResult =
  | { type: 'acquired'; recordId: string }
  | { type: 'replay'; statusCode: number; responseBody: unknown }
  | { type: 'in_progress' }
  | { type: 'conflict' };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`;
}

export function buildRequestHash(payload: unknown): string {
  const normalized = stableStringify(payload);
  return createHash('sha256').update(normalized).digest('hex');
}

export async function acquireIdempotency(
  supabase: SupabaseClient,
  input: { endpoint: string; idempotencyKey: string; requestHash: string; lockSeconds?: number }
): Promise<IdempotencyAcquireResult> {
  const lockSeconds = input.lockSeconds ?? 300;
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockSeconds * 1000).toISOString();

  const { data: existing } = await supabase
    .from('api_idempotency_keys')
    .select('id, endpoint, idempotency_key, request_hash, state, status_code, response_body, locked_until')
    .eq('endpoint', input.endpoint)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle<IdempotencyRecord>();

  if (existing) {
    if (existing.request_hash !== input.requestHash) {
      return { type: 'conflict' };
    }

    if (existing.state === 'completed') {
      return {
        type: 'replay',
        statusCode: existing.status_code ?? 200,
        responseBody: existing.response_body,
      };
    }

    if (existing.state === 'in_progress' && new Date(existing.locked_until) > now) {
      return { type: 'in_progress' };
    }

    const { error: takeoverError } = await supabase
      .from('api_idempotency_keys')
      .update({
        state: 'in_progress',
        locked_until: lockUntil,
      })
      .eq('id', existing.id);

    if (takeoverError) {
      return { type: 'in_progress' };
    }

    return { type: 'acquired', recordId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('api_idempotency_keys')
    .insert({
      endpoint: input.endpoint,
      idempotency_key: input.idempotencyKey,
      request_hash: input.requestHash,
      state: 'in_progress',
      locked_until: lockUntil,
    })
    .select('id')
    .single();

  if (!insertError && inserted?.id) {
    return { type: 'acquired', recordId: inserted.id as string };
  }

  return { type: 'in_progress' };
}

export async function finalizeIdempotency(
  supabase: SupabaseClient,
  input: {
    recordId: string;
    statusCode: number;
    responseBody: unknown;
    failed?: boolean;
  }
) {
  const state: IdempotencyState = input.failed ? 'failed' : 'completed';
  await supabase
    .from('api_idempotency_keys')
    .update({
      state,
      status_code: input.statusCode,
      response_body: input.responseBody,
      locked_until: new Date().toISOString(),
    })
    .eq('id', input.recordId);
}

export function idempotencyReplayResponse(statusCode: number, responseBody: unknown) {
  return NextResponse.json(responseBody, {
    status: statusCode,
    headers: {
      'Idempotency-Replayed': 'true',
    },
  });
}
