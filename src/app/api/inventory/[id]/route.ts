import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/schemas';
import type { InventoryItemUpdate } from '@/types';

/**
 * Individual Inventory Item API
 * 
 * GET /api/inventory/[id] - Get single item
 * PUT /api/inventory/[id] - Update item
 * DELETE /api/inventory/[id] - Archive item
 */

// UUID validation helper
function validateUUID(id: string): boolean {
  return uuidSchema.safeParse(id).success;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format before querying
    if (!validateUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format. Expected a valid UUID.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Inventory item not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    return NextResponse.json({ item });

  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format before querying
    if (!validateUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format. Expected a valid UUID.' },
        { status: 400 }
      );
    }

    const body: InventoryItemUpdate = await request.json();

    const supabase = createServerClient();

    const { data: item, error: updateError } = await supabase
      .from('inventory_items')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Inventory item not found' },
          { status: 404 }
        );
      }
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      item,
    });

  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format before querying
    if (!validateUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format. Expected a valid UUID.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Soft delete by setting is_archived = true
    const { error: deleteError } = await supabase
      .from('inventory_items')
      .update({ is_archived: true })
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Item archived successfully',
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete item' },
      { status: 500 }
    );
  }
}
