/**
 * Supabase Realtime - Sync Progress Channel
 * 
 * Broadcasts sync progress updates from API routes to the frontend.
 * Used for real-time UI updates during long-running sync operations.
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

// Event types for sync progress
export type SyncEventType = 
  | 'sync:started'
  | 'sync:progress'
  | 'sync:platform_complete'
  | 'sync:complete'
  | 'sync:error';

export interface SyncProgressEvent {
  type: SyncEventType;
  itemId: string;
  platform?: 'shopify' | 'hubspot' | 'notion';
  progress?: number; // 0-100
  message: string;
  result?: {
    success: boolean;
    productId?: string;
    dealId?: string;
    pageId?: string;
    error?: string;
  };
  timestamp: string;
}

// Server-side: Create a channel for broadcasting
export function createSyncChannel(itemId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  return supabase.channel(`sync:${itemId}`);
}

// Server-side: Broadcast a sync progress event
export async function broadcastSyncProgress(
  channel: RealtimeChannel,
  event: Omit<SyncProgressEvent, 'timestamp'>
) {
  await channel.send({
    type: 'broadcast',
    event: 'sync_progress',
    payload: {
      ...event,
      timestamp: new Date().toISOString(),
    },
  });
}

// Helper to broadcast common events
export const SyncBroadcaster = {
  async started(channel: RealtimeChannel, itemId: string) {
    await broadcastSyncProgress(channel, {
      type: 'sync:started',
      itemId,
      progress: 0,
      message: 'Starting sync...',
    });
  },

  async platformStarted(channel: RealtimeChannel, itemId: string, platform: SyncProgressEvent['platform']) {
    const platformNames = { shopify: 'Shopify', hubspot: 'HubSpot', notion: 'Notion' };
    await broadcastSyncProgress(channel, {
      type: 'sync:progress',
      itemId,
      platform,
      progress: platform === 'shopify' ? 10 : platform === 'hubspot' ? 40 : 70,
      message: `Syncing to ${platformNames[platform!]}...`,
    });
  },

  async platformComplete(
    channel: RealtimeChannel, 
    itemId: string, 
    platform: SyncProgressEvent['platform'],
    result: SyncProgressEvent['result']
  ) {
    const platformNames = { shopify: 'Shopify', hubspot: 'HubSpot', notion: 'Notion' };
    await broadcastSyncProgress(channel, {
      type: 'sync:platform_complete',
      itemId,
      platform,
      progress: platform === 'shopify' ? 33 : platform === 'hubspot' ? 66 : 100,
      message: result?.success 
        ? `${platformNames[platform!]} sync complete`
        : `${platformNames[platform!]} sync failed`,
      result,
    });
  },

  async complete(channel: RealtimeChannel, itemId: string, success: boolean, message?: string) {
    await broadcastSyncProgress(channel, {
      type: 'sync:complete',
      itemId,
      progress: 100,
      message: message || (success ? 'Sync complete!' : 'Sync completed with errors'),
      result: { success },
    });
  },

  async error(channel: RealtimeChannel, itemId: string, errorMessage: string) {
    await broadcastSyncProgress(channel, {
      type: 'sync:error',
      itemId,
      message: errorMessage,
      result: { success: false, error: errorMessage },
    });
  },
};
