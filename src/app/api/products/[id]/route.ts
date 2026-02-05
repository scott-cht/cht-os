import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Get a single product by ID
 * 
 * GET /api/products/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('product_onboarding')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ product: data });

  } catch (error) {
    console.error('Fetch product error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

/**
 * Update a product by ID
 * 
 * PATCH /api/products/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('product_onboarding')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ product: data });

  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

/**
 * Delete (archive) a product by ID
 * Uses soft delete for consistency with inventory_items
 * 
 * DELETE /api/products/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // Soft delete by setting archived flag
    const { error } = await supabase
      .from('product_onboarding')
      .update({ 
        archived: true,
        status: 'archived',
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, archived: true });

  } catch (error) {
    console.error('Archive product error:', error);
    return NextResponse.json(
      { error: 'Failed to archive product' },
      { status: 500 }
    );
  }
}
