'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-client';
import { notify } from '@/lib/store/app-store';
import type { InventoryItem } from '@/types';

/**
 * Inventory Hooks
 * 
 * React Query based hooks for inventory data fetching, caching, and mutations
 */

// API response types
interface InventoryListResponse {
  items: InventoryItem[];
  count: number;
  total: number;
  pagination: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

interface InventoryFilters {
  listing_type?: string;
  listing_status?: string;
  sync_status?: string;
  condition_grade?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

// Fetch inventory list
async function fetchInventory(filters: InventoryFilters): Promise<InventoryListResponse> {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      params.set(key, String(value));
    }
  });

  const response = await fetch(`/api/inventory?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch inventory');
  }
  
  return response.json();
}

// Fetch single inventory item
async function fetchInventoryItem(id: string): Promise<InventoryItem> {
  const response = await fetch(`/api/inventory/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch inventory item');
  }
  
  const data = await response.json();
  return data.item;
}

// Update inventory item
async function updateInventoryItem(
  id: string,
  updates: Partial<InventoryItem>
): Promise<InventoryItem> {
  const response = await fetch(`/api/inventory/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update inventory item');
  }
  
  const data = await response.json();
  return data.item;
}

// Sync inventory item
async function syncInventoryItem(id: string): Promise<{ success: boolean; result: unknown }> {
  const response = await fetch(`/api/inventory/${id}/sync`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Sync failed');
  }
  
  return response.json();
}

// Delete inventory item
async function deleteInventoryItem(id: string): Promise<void> {
  const response = await fetch(`/api/inventory/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete inventory item');
  }
}

/**
 * Hook: Fetch inventory list with filters
 */
export function useInventoryList(filters: InventoryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.list(filters),
    queryFn: () => fetchInventory(filters),
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

/**
 * Hook: Fetch single inventory item
 */
export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(id || ''),
    queryFn: () => fetchInventoryItem(id!),
    enabled: !!id,
  });
}

/**
 * Hook: Update inventory item
 */
export function useUpdateInventory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) =>
      updateInventoryItem(id, updates),
    
    onSuccess: (updatedItem) => {
      // Update the item in cache
      queryClient.setQueryData(
        queryKeys.inventory.detail(updatedItem.id),
        updatedItem
      );
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      
      notify.success('Item updated', 'Changes saved successfully');
    },
    
    onError: (error: Error) => {
      notify.error('Update failed', error.message);
    },
  });
}

/**
 * Hook: Sync inventory item to platforms
 */
export function useSyncInventory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => syncInventoryItem(id),
    
    onSuccess: (result, id) => {
      // Invalidate the item to refetch with new sync status
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      
      if (result.success) {
        notify.success('Sync complete', 'Item successfully synced to platforms');
      } else {
        notify.warning('Sync completed with issues', 'Some platforms may have failed');
      }
    },
    
    onError: (error: Error) => {
      notify.error('Sync failed', error.message);
    },
  });
}

/**
 * Hook: Delete inventory item
 */
export function useDeleteInventory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.inventory.detail(id) });
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      
      notify.success('Item deleted', 'Inventory item has been removed');
    },
    
    onError: (error: Error) => {
      notify.error('Delete failed', error.message);
    },
  });
}

/**
 * Hook: Prefetch inventory item (for hover/navigation optimization)
 */
export function usePrefetchInventoryItem() {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.inventory.detail(id),
      queryFn: () => fetchInventoryItem(id),
      staleTime: 30 * 1000,
    });
  };
}

/**
 * Hook: Invalidate all inventory queries (useful after bulk operations)
 */
export function useInvalidateInventory() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all() });
  };
}
