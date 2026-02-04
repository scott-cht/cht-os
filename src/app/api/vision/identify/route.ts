import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { VisionAIResponse } from '@/types';

/**
 * Vision AI Product Identification API
 * 
 * POST /api/vision/identify
 * Body: { image: string (base64 or URL) }
 * 
 * Uses Claude's vision capability to identify:
 * - Brand
 * - Model/Product name
 * - Serial number (if visible)
 */

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

const IDENTIFICATION_PROMPT = `You are an expert at identifying audio/video equipment, electronics, and home appliances.

Analyze this product image and extract:
1. **Brand** - The manufacturer (e.g., Marantz, Denon, Sony, Samsung)
2. **Model** - The specific model number/name (e.g., AV30, SR7015, KD-65X85K)
3. **Serial Number** - If visible on the product label or sticker

Look for:
- Front panel branding and model badges
- Product labels (usually on back/bottom)
- Serial number stickers
- Any visible text that identifies the product

Important:
- If you cannot determine something with confidence, return null for that field
- For serial numbers, look for labels saying "S/N", "Serial", or similar
- Model numbers often include letters and numbers (e.g., AVR-X3800H)

Respond with ONLY valid JSON in this exact format:
{
  "brand": "string or null",
  "model": "string or null", 
  "serial_number": "string or null",
  "confidence": 0.0 to 1.0,
  "raw_text": "all visible text you can read"
}`;

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required (base64 or URL)' },
        { status: 400 }
      );
    }

    // Determine if image is base64 or URL
    const isBase64 = image.startsWith('data:') || !image.startsWith('http');
    
    let imageContent: Anthropic.ImageBlockParam;
    
    if (isBase64) {
      // Extract base64 data and media type
      let base64Data = image;
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
      
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mediaType = matches[1] as typeof mediaType;
          base64Data = matches[2];
        }
      }
      
      imageContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      };
    } else {
      imageContent = {
        type: 'image',
        source: {
          type: 'url',
          url: image,
        },
      };
    }

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: IDENTIFICATION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    // Parse JSON from response
    let jsonStr = textContent.text;
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());

    const result: VisionAIResponse = {
      brand: parsed.brand || null,
      model: parsed.model || null,
      serial_number: parsed.serial_number || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      raw_text: parsed.raw_text || '',
      identified_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Vision identification error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to identify product',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vision/identify - Documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/vision/identify',
    method: 'POST',
    description: 'Identify product brand, model, and serial number from image',
    body: {
      image: 'string - base64 encoded image or URL',
    },
    response: {
      success: 'boolean',
      brand: 'string | null',
      model: 'string | null',
      serial_number: 'string | null',
      confidence: 'number (0-1)',
      raw_text: 'string - all visible text',
      identified_at: 'ISO timestamp',
    },
    notes: [
      'Uses Claude Vision for identification',
      'Supports JPEG, PNG, GIF, WebP formats',
      'Serial numbers are optional - returns null if not found',
      'Confidence score indicates reliability of identification',
    ],
  });
}
