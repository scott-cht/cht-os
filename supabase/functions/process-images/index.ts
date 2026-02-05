/**
 * Supabase Edge Function: process-images
 * 
 * Handles image processing in a Deno environment:
 * - Downloads images from URLs
 * - Uploads to Supabase Storage
 * - Uses Supabase's built-in image transformation for WebP conversion
 * 
 * Deploy with: supabase functions deploy process-images
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessImagesRequest {
  productId: string;
  imageUrls: string[];
  brand: string;
  model: string;
  category: string;
  altTexts?: string[];
}

interface ProcessedImage {
  originalUrl: string;
  storagePath: string;
  publicUrl: string;
  filename: string;
  altText: string;
}

/**
 * Slugify text for SEO-friendly filenames
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate SEO-friendly filename
 */
function generateFilename(brand: string, model: string, category: string, index: number): string {
  return `${slugify(brand)}-${slugify(model)}-${slugify(category)}-${index}.webp`;
}

/**
 * Download image and upload to Supabase Storage
 */
async function processImage(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  imageUrl: string,
  productId: string,
  filename: string,
  altText: string
): Promise<ProcessedImage> {
  // Download the image
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProductScout/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  // Get the image as ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Determine content type
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Storage path
  const storagePath = `${productId}/${filename}`;

  // Upload to Supabase Storage
  // Note: Using original format, Supabase Storage can transform on-the-fly
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, uint8Array, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL with transformation parameters
  // Supabase Storage supports on-the-fly transformation
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath, {
      transform: {
        format: 'webp',
        quality: 85,
        width: 1200,
        height: 1200,
        resize: 'contain',
      },
    });

  return {
    originalUrl: imageUrl,
    storagePath,
    publicUrl: urlData.publicUrl,
    filename,
    altText,
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bucket = Deno.env.get('STORAGE_BUCKET') || 'product-images';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const body: ProcessImagesRequest = await req.json();
    const { productId, imageUrls, brand, model, category, altTexts = [] } = body;

    if (!productId || !imageUrls || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, imageUrls' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 10 images
    const urlsToProcess = imageUrls.slice(0, 10);

    // Process images
    const processed: ProcessedImage[] = [];
    const failed: { url: string; error: string }[] = [];

    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      const altText = altTexts[i] || `${brand} ${model} product image ${i + 1}`;
      const filename = generateFilename(brand, model, category, i + 1);

      try {
        const result = await processImage(
          supabase,
          bucket,
          url,
          productId,
          filename,
          altText
        );
        processed.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process image ${i + 1}:`, errorMessage);
        failed.push({ url, error: errorMessage });
      }
    }

    // Update inventory item with processed images
    if (processed.length > 0) {
      const processedUrls = processed.map((img) => img.publicUrl);
      const processedMeta = processed.map((img) => ({
        url: img.publicUrl,
        filename: img.filename,
        altText: img.altText,
      }));

      // Get current item to merge specifications
      const { data: currentItem } = await supabase
        .from('inventory_items')
        .select('specifications')
        .eq('id', productId)
        .single();

      const currentSpecs = (currentItem?.specifications as Record<string, unknown>) || {};

      await supabase
        .from('inventory_items')
        .update({
          image_urls: processedUrls,
          specifications: {
            ...currentSpecs,
            _processedImages: {
              original: urlsToProcess,
              processed: processedMeta,
              processedAt: new Date().toISOString(),
            },
          },
        })
        .eq('id', productId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        results: {
          total: urlsToProcess.length,
          processed: processed.length,
          failed: failed.length,
          images: processed,
          errors: failed.length > 0 ? failed : undefined,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Processing failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
