import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  parsePageWithVision,
  enrichPricelistItem,
  validatePricelistItem,
  type PricelistItem,
  type PricelistParseResult,
} from '@/lib/pricelist/parser';

/**
 * PDF Pricelist Parser API
 * 
 * POST /api/pricelist/parse
 * Content-Type: multipart/form-data
 * Body: { file: PDF file }
 * 
 * Converts PDF pages to images and uses Claude Vision to extract product data.
 */

export async function POST(request: NextRequest) {
  // Rate limit check (uses AI so apply Anthropic limits)
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.anthropic, clientIp);
  
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. Please try again later.', retryAfter: rateCheck.retryAfter },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfter),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', success: false },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF', success: false },
        { status: 400 }
      );
    }

    // Check file size (max 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 20MB', success: false },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert PDF pages to images
    const allItems: PricelistItem[] = [];
    const allWarnings: string[] = [];
    let pageCount = 0;

    try {
      // Dynamic import to avoid build-time issues
      const { pdf } = await import('pdf-to-img');
      
      // pdf-to-img returns a Promise that resolves to an async iterable
      const document = await pdf(buffer, { scale: 2.0 }); // Higher scale for better OCR
      
      for await (const pageImage of document) {
        pageCount++;
        
        // Convert PNG buffer to base64
        const base64Image = `data:image/png;base64,${pageImage.toString('base64')}`;
        
        // Parse this page with Claude Vision
        const pageResult = await parsePageWithVision(base64Image, pageCount);
        
        // Enrich and validate items
        for (const item of pageResult.items) {
          const enrichedItem = enrichPricelistItem(item);
          const validation = validatePricelistItem(enrichedItem);
          
          if (validation.valid) {
            allItems.push(enrichedItem);
          } else {
            allWarnings.push(`Page ${pageCount}: Skipped "${item.product_name || 'unknown'}" - ${validation.errors.join(', ')}`);
          }
        }
        
        allWarnings.push(...pageResult.warnings);
        
        // Limit to 10 pages to avoid excessive API costs
        if (pageCount >= 10) {
          allWarnings.push('Stopped at 10 pages. Please split larger documents.');
          break;
        }
      }
    } catch (pdfError) {
      console.error('PDF conversion error:', pdfError);
      return NextResponse.json(
        { 
          error: 'Failed to process PDF. The file may be corrupted or password-protected.',
          success: false,
        },
        { status: 400 }
      );
    }

    const result: PricelistParseResult = {
      success: true,
      items: allItems,
      pageCount,
      warnings: allWarnings,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Pricelist parse error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to parse pricelist',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pricelist/parse - Documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/pricelist/parse',
    method: 'POST',
    description: 'Parse a PDF pricelist and extract product data',
    body: {
      file: 'PDF file (multipart/form-data)',
    },
    response: {
      success: 'boolean',
      items: 'array of extracted products',
      pageCount: 'number of pages processed',
      warnings: 'array of warning messages',
    },
    limits: {
      maxFileSize: '20MB',
      maxPages: '10 pages',
    },
    notes: [
      'Uses Claude Vision for extraction',
      'Converts each PDF page to image for processing',
      'Best results with clean, tabular pricelists',
      'Cost price is required for each item',
    ],
  });
}
