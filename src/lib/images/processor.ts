import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { ProcessedImage } from '@/types';
import { config } from '@/config';

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
 * Format: brand-model-category-index.webp
 */
export function generateSeoFilename(
  brand: string,
  model: string,
  category: string,
  index: number
): string {
  return `${slugify(brand)}-${slugify(model)}-${slugify(category)}-${index}.webp`;
}

/**
 * Get Supabase Storage client
 */
function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Convert image buffer to WebP format using sharp
 * Per PRD: All images must be converted to WebP
 */
export async function convertToWebp(
  imageBuffer: Buffer,
  options: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {}
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { 
    quality = config.images.quality, 
    maxWidth = config.images.maxWidth, 
    maxHeight = config.images.maxHeight 
  } = options;
  
  let pipeline = sharp(imageBuffer);
  
  // Get original metadata
  const metadata = await pipeline.metadata();
  
  // Resize if needed while maintaining aspect ratio
  if (metadata.width && metadata.height) {
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }
  
  // Convert to WebP
  const buffer = await pipeline
    .webp({ quality })
    .toBuffer();
  
  // Get final dimensions
  const finalMetadata = await sharp(buffer).metadata();
  
  return {
    buffer,
    width: finalMetadata.width || 0,
    height: finalMetadata.height || 0,
  };
}

/**
 * Upload image buffer to Supabase Storage
 */
export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  productId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getStorageClient();
  
  // Create path: productId/filename
  const storagePath = `${productId}/${filename}`;
  
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(config.images.bucket)
    .upload(storagePath, buffer, {
      contentType: 'image/webp',
      upsert: true, // Overwrite if exists
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(config.images.bucket)
    .getPublicUrl(storagePath);
  
  return { storagePath, publicUrl };
}

/**
 * Download, process, and upload an image
 */
export async function processAndUploadImage(
  imageUrl: string,
  brand: string,
  model: string,
  category: string,
  index: number,
  productId: string,
  altText?: string
): Promise<ProcessedImage> {
  // Fetch the image
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProductScout/1.0)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  
  // Convert to WebP
  const { buffer, width, height } = await convertToWebp(imageBuffer);
  
  // Generate SEO filename
  const filename = generateSeoFilename(brand, model, category, index);
  
  // Upload to Supabase Storage
  const { storagePath, publicUrl } = await uploadToStorage(buffer, filename, productId);
  
  return {
    originalUrl: imageUrl,
    storagePath,
    publicUrl,
    filename,
    altText: altText || `${brand} ${model} product image ${index}`,
    width,
    height,
  };
}

/**
 * Process and upload multiple images
 */
export async function processProductImages(
  imageUrls: string[],
  brand: string,
  model: string,
  category: string,
  productId: string,
  altTexts?: string[]
): Promise<{ processed: ProcessedImage[]; failed: string[] }> {
  const processed: ProcessedImage[] = [];
  const failed: string[] = [];
  
  // Process images sequentially to avoid rate limiting
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const altText = altTexts?.[i];
    
    try {
      const result = await processAndUploadImage(
        url,
        brand,
        model,
        category,
        i + 1,
        productId,
        altText
      );
      processed.push(result);
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error);
      failed.push(url);
    }
  }
  
  return { processed, failed };
}
