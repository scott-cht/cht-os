# Supabase Edge Functions

This directory contains Supabase Edge Functions for the Product Lister application.

## Functions

### process-images

Handles image processing in a Deno environment:
- Downloads images from external URLs
- Uploads to Supabase Storage
- Uses Supabase's built-in image transformation for WebP conversion
- Updates inventory items with processed image URLs

## Deployment

### Prerequisites

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

### Deploy Functions

Deploy all functions:
```bash
supabase functions deploy
```

Or deploy a specific function:
```bash
supabase functions deploy process-images
```

### Environment Variables

Set required secrets for the Edge Functions:

```bash
# Set the service role key (required for storage operations)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Set the storage bucket name (optional, defaults to 'product-images')
supabase secrets set STORAGE_BUCKET=product-images
```

Note: `SUPABASE_URL` is automatically available in Edge Functions.

## Local Development

Start the Edge Functions locally:
```bash
supabase functions serve
```

This will start all functions at `http://localhost:54321/functions/v1/`.

## Testing

Test the process-images function:
```bash
curl -X POST 'http://localhost:54321/functions/v1/process-images' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "test-123",
    "imageUrls": ["https://example.com/image.jpg"],
    "brand": "TestBrand",
    "model": "TestModel",
    "category": "test"
  }'
```

## Architecture

The application uses a hybrid approach:

1. **Primary**: Supabase Edge Function
   - Offloads heavy processing to Supabase's infrastructure
   - Avoids timeout issues on Next.js API routes
   - Scales automatically

2. **Fallback**: Local Node.js processing
   - Uses Sharp for image conversion
   - Activated when Edge Function is unavailable
   - Useful for local development

The `processProductImagesHybrid()` function in `src/lib/images/edge-processor.ts` 
handles this logic automatically.

## Storage Configuration

Ensure your Supabase Storage bucket is configured:

1. Create a bucket named `product-images` (or your custom bucket name)
2. Enable public access for the bucket
3. Enable image transformations in your Supabase project settings

### RLS Policies

Add these policies to your `storage.objects` table:

```sql
-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow service role to upload
CREATE POLICY "Service role can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  auth.role() = 'service_role'
);

-- Allow service role to update
CREATE POLICY "Service role can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' AND
  auth.role() = 'service_role'
);
```
