/**
 * Edge Function Client for Image Processing
 * 
 * Invokes the Supabase Edge Function for image processing,
 * offloading heavy work from the Next.js API routes.
 */

import { createClient } from '@supabase/supabase-js';
import type { ProcessedImage } from '@/types';

interface ProcessImagesParams {
  productId: string;
  imageUrls: string[];
  brand: string;
  model: string;
  category: string;
  altTexts?: string[];
}

interface ProcessImagesResult {
  success: boolean;
  productId: string;
  results: {
    total: number;
    processed: number;
    failed: number;
    images: ProcessedImage[];
    errors?: { url: string; error: string }[];
  };
}

/**
 * Get Supabase client for invoking Edge Functions
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Process images via Supabase Edge Function
 * 
 * This offloads image processing to Supabase's infrastructure,
 * avoiding timeouts on the Next.js API routes.
 */
export async function processImagesViaEdge(
  params: ProcessImagesParams
): Promise<ProcessImagesResult> {
  const supabase = getSupabaseClient();

  // Invoke the Edge Function
  const { data, error } = await supabase.functions.invoke<ProcessImagesResult>(
    'process-images',
    {
      body: params,
    }
  );

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  if (!data) {
    throw new Error('No response from edge function');
  }

  return data;
}

/**
 * Check if Edge Function is available
 * Falls back to local processing if not
 */
export async function isEdgeFunctionAvailable(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // Try a simple health check
    const { error } = await supabase.functions.invoke('process-images', {
      body: { healthCheck: true },
    });

    // If we get a 400 (bad request) it means the function exists but rejected our request
    // which is fine - it means it's available
    return !error || error.message.includes('Missing required fields');
  } catch {
    return false;
  }
}

/**
 * Hybrid processor - uses Edge Function if available, falls back to local
 */
export async function processProductImagesHybrid(
  params: ProcessImagesParams
): Promise<ProcessImagesResult> {
  const edgeAvailable = await isEdgeFunctionAvailable();

  if (edgeAvailable) {
    console.log('[ImageProcessor] Using Edge Function');
    return processImagesViaEdge(params);
  }

  // Fallback to local processing (import dynamically to avoid bundling sharp in client)
  console.log('[ImageProcessor] Falling back to local processing');
  const { processProductImages } = await import('./processor');
  
  const { processed, failed } = await processProductImages(
    params.imageUrls,
    params.brand,
    params.model,
    params.category,
    params.productId,
    params.altTexts
  );

  return {
    success: failed.length === 0,
    productId: params.productId,
    results: {
      total: params.imageUrls.length,
      processed: processed.length,
      failed: failed.length,
      images: processed,
      errors: failed.length > 0 
        ? failed.map(url => ({ url, error: 'Processing failed' })) 
        : undefined,
    },
  };
}
