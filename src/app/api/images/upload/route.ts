import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';

/**
 * Image Upload endpoint
 * 
 * POST /api/images/upload
 * FormData: files[] (image files), productId (optional)
 * 
 * Uploads images to Supabase Storage and returns public URLs
 */

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for file uploads
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimiters.uploads, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const productId = formData.get('productId') as string | null;
    const brand = formData.get('brand') as string | null;
    const model = formData.get('model') as string | null;

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Limit uploads to 10 at a time
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 images per upload' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const uploadedImages: {
      id: string;
      url: string;
      filename: string;
      altText: string;
      width?: number;
      height?: number;
    }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Allowed: JPG, PNG, WebP, GIF`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum 5MB`);
        continue;
      }

      try {
        // Generate SEO-friendly filename
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const slug = generateSlug(brand, model, i + 1);
        const filename = `${slug}.${ext}`;
        const storagePath = productId 
          ? `products/${productId}/${filename}`
          : `uploads/${uuidv4()}/${filename}`;

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (uploadError) {
          errors.push(`${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);

        // Generate default alt text
        const altText = generateAltText(brand, model, i + 1);

        uploadedImages.push({
          id: uuidv4(),
          url: urlData.publicUrl,
          filename,
          altText,
        });

      } catch (err) {
        errors.push(`${file.name}: Upload failed`);
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        uploaded: uploadedImages.length,
        failed: errors.length,
        total: files.length,
      },
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Generate SEO-friendly slug for filename
 */
function generateSlug(brand: string | null, model: string | null, index: number): string {
  const parts: string[] = [];
  
  if (brand) {
    parts.push(brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  }
  
  if (model) {
    parts.push(model.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  }
  
  parts.push(`image-${index}`);
  parts.push(Date.now().toString(36)); // Add unique suffix
  
  return parts.join('-').replace(/--+/g, '-');
}

/**
 * Generate default alt text
 */
function generateAltText(brand: string | null, model: string | null, index: number): string {
  const parts: string[] = [];
  
  if (brand) parts.push(brand);
  if (model) parts.push(model);
  parts.push(`product image ${index}`);
  
  return parts.join(' ');
}
