'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { SyncProgressEvent } from '@/lib/realtime/sync-channel';

interface UseSyncProgressOptions {
  onComplete?: (success: boolean) => void;
  onError?: (error: string) => void;
}

interface SyncProgressState {
  isActive: boolean;
  progress: number;
  message: string;
  currentPlatform?: 'shopify' | 'hubspot' | 'notion';
  platformResults: {
    shopify?: { success: boolean; productId?: string; error?: string };
    hubspot?: { success: boolean; dealId?: string; error?: string };
    notion?: { success: boolean; pageId?: string; error?: string };
  };
  error?: string;
}

const initialState: SyncProgressState = {
  isActive: false,
  progress: 0,
  message: '',
  platformResults: {},
};

/**
 * Hook to subscribe to real-time sync progress for an inventory item
 */
export function useSyncProgress(
  itemId: string | null,
  options: UseSyncProgressOptions = {}
) {
  const [state, setState] = useState<SyncProgressState>(initialState);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Subscribe to sync channel
  useEffect(() => {
    if (!itemId) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const syncChannel = supabase.channel(`sync:${itemId}`);

    syncChannel
      .on('broadcast', { event: 'sync_progress' }, ({ payload }) => {
        const event = payload as SyncProgressEvent;
        
        setState(prev => {
          const newState = { ...prev };

          switch (event.type) {
            case 'sync:started':
              return {
                ...initialState,
                isActive: true,
                progress: event.progress || 0,
                message: event.message,
              };

            case 'sync:progress':
              newState.progress = event.progress || prev.progress;
              newState.message = event.message;
              newState.currentPlatform = event.platform;
              break;

            case 'sync:platform_complete':
              newState.progress = event.progress || prev.progress;
              newState.message = event.message;
              if (event.platform && event.result) {
                newState.platformResults = {
                  ...prev.platformResults,
                  [event.platform]: event.result,
                };
              }
              break;

            case 'sync:complete':
              newState.isActive = false;
              newState.progress = 100;
              newState.message = event.message;
              newState.currentPlatform = undefined;
              options.onComplete?.(event.result?.success ?? true);
              break;

            case 'sync:error':
              newState.isActive = false;
              newState.error = event.result?.error || event.message;
              newState.message = event.message;
              options.onError?.(newState.error);
              break;
          }

          return newState;
        });
      })
      .subscribe();

    setChannel(syncChannel);

    return () => {
      syncChannel.unsubscribe();
    };
  }, [itemId, options.onComplete, options.onError]);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    reset,
  };
}

/**
 * Hook to subscribe to multiple sync operations (for bulk sync)
 */
export function useBulkSyncProgress(itemIds: string[]) {
  const [progress, setProgress] = useState<Record<string, SyncProgressState>>({});

  useEffect(() => {
    if (itemIds.length === 0) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channels: RealtimeChannel[] = [];

    itemIds.forEach(itemId => {
      const channel = supabase.channel(`sync:${itemId}`);

      channel
        .on('broadcast', { event: 'sync_progress' }, ({ payload }) => {
          const event = payload as SyncProgressEvent;

          setProgress(prev => ({
            ...prev,
            [itemId]: {
              isActive: event.type !== 'sync:complete' && event.type !== 'sync:error',
              progress: event.progress || 0,
              message: event.message,
              currentPlatform: event.platform,
              platformResults: event.result ? {
                ...prev[itemId]?.platformResults,
                ...(event.platform ? { [event.platform]: event.result } : {}),
              } : prev[itemId]?.platformResults || {},
              error: event.type === 'sync:error' ? event.message : undefined,
            },
          }));
        })
        .subscribe();

      channels.push(channel);
    });

    return () => {
      channels.forEach(ch => ch.unsubscribe());
    };
  }, [itemIds.join(',')]);

  const totalProgress = itemIds.length > 0
    ? Object.values(progress).reduce((sum, p) => sum + (p.progress || 0), 0) / itemIds.length
    : 0;

  const allComplete = itemIds.length > 0 && 
    itemIds.every(id => progress[id]?.progress === 100 || progress[id]?.error);

  return {
    progress,
    totalProgress,
    allComplete,
    activeCount: Object.values(progress).filter(p => p.isActive).length,
    errorCount: Object.values(progress).filter(p => p.error).length,
  };
}
