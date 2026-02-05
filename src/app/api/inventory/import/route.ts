import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { parseCSV, validateImport, type ParsedImportRow } from '@/lib/utils/import';

/**
 * POST /api/inventory/import
 * 
 * Imports multiple inventory items from CSV data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both raw CSV text and parsed items
    let validItems: ParsedImportRow[];
    let validationWarnings: string[] = [];
    
    if (body.csvText) {
      // Parse and validate CSV
      const rows = parseCSV(body.csvText);
      const validation = validateImport(rows);
      
      if (validation.invalidCount > 0) {
        return NextResponse.json({
          success: false,
          error: 'Validation failed',
          validation: {
            valid: validation.validCount,
            invalid: validation.invalidCount,
            errors: validation.invalid.map(r => ({
              row: r.rowNumber,
              errors: r.errors,
            })),
            warnings: validation.warnings,
          },
        }, { status: 400 });
      }
      
      validItems = validation.valid;
      validationWarnings = validation.warnings;
    } else if (body.items && Array.isArray(body.items)) {
      // Already validated items
      validItems = body.items;
    } else {
      return NextResponse.json(
        { error: 'Either csvText or items array is required' },
        { status: 400 }
      );
    }
    
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid items to import' },
        { status: 400 }
      );
    }
    
    // Limit batch size
    const MAX_BATCH_SIZE = 100;
    if (validItems.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items` },
        { status: 400 }
      );
    }
    
    const supabase = createServerClient();
    
    // Prepare items for insertion
    const itemsToInsert = validItems.map(item => ({
      ...item.data,
      sync_status: 'pending',
      listing_status: item.data.listing_status || 'draft',
    }));
    
    // Insert all items
    const { data: insertedItems, error: insertError } = await supabase
      .from('inventory_items')
      .insert(itemsToInsert)
      .select();
    
    if (insertError) {
      console.error('Batch import error:', insertError);
      return NextResponse.json(
        { error: 'Failed to import items' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      imported: insertedItems?.length || 0,
      items: insertedItems,
      warnings: validationWarnings,
      message: `Successfully imported ${insertedItems?.length || 0} items`,
    });
    
  } catch (error) {
    console.error('Import error:', error);
    
    if (error instanceof Error && error.message.includes('CSV')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
