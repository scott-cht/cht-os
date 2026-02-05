import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient configuration
 * 
 * Default options optimized for the product lister use case
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data considered fresh for 30 seconds
        staleTime: 30 * 1000,
        // Cache retained for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests up to 2 times
        retry: 2,
        // Refetch on window focus for real-time accuracy
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data exists
        refetchOnMount: false,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
      },
    },
  });
}

// Query keys factory for type safety and consistency
export const queryKeys = {
  all: ['product-lister'] as const,
  
  // Inventory
  inventory: {
    all: () => [...queryKeys.all, 'inventory'] as const,
    lists: () => [...queryKeys.inventory.all(), 'list'] as const,
    list: (filters: Record<string, unknown>) => 
      [...queryKeys.inventory.lists(), filters] as const,
    details: () => [...queryKeys.inventory.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.inventory.details(), id] as const,
    stats: () => [...queryKeys.inventory.all(), 'stats'] as const,
  },
  
  // Products (onboarding)
  products: {
    all: () => [...queryKeys.all, 'products'] as const,
    lists: () => [...queryKeys.products.all(), 'list'] as const,
    list: (filters: Record<string, unknown>) => 
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },
  
  // Audit log
  audit: {
    all: () => [...queryKeys.all, 'audit'] as const,
    entity: (entityType: string, entityId: string) => 
      [...queryKeys.audit.all(), entityType, entityId] as const,
  },
  
  // Search
  search: {
    all: () => [...queryKeys.all, 'search'] as const,
    query: (term: string) => [...queryKeys.search.all(), term] as const,
  },
  
  // Specifications
  specifications: {
    all: () => [...queryKeys.all, 'specifications'] as const,
    model: (brand: string, model: string) => 
      [...queryKeys.specifications.all(), brand, model] as const,
  },
  
  // RRP
  rrp: {
    all: () => [...queryKeys.all, 'rrp'] as const,
    product: (brand: string, model: string) => 
      [...queryKeys.rrp.all(), brand, model] as const,
  },
};
