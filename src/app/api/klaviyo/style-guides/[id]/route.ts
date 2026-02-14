import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/response';

/**
 * PATCH /api/klaviyo/style-guides/[id]
 * Update layout_notes and/or section_tags for section tagging (products, category links, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const layout_notes = body.layoutNotes !== undefined ? body.layoutNotes : undefined;
    const section_tags = body.sectionTags !== undefined ? body.sectionTags : undefined;
    if (layout_notes === undefined && section_tags === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Provide layoutNotes and/or sectionTags' } },
        { status: 400 }
      );
    }
    const supabase = createServerClient();
    const updates: Record<string, unknown> = {};
    if (layout_notes !== undefined) updates.layout_notes = layout_notes;
    if (section_tags !== undefined) updates.section_tags = section_tags;
    const { data, error } = await supabase
      .from('email_style_guides')
      .update(updates)
      .eq('id', id)
      .select('id, layout_notes, section_tags')
      .single();

    if (error) {
      console.error('Style guide update error:', error);
      return errors.database(error.message);
    }
    return NextResponse.json({
      success: true,
      styleGuide: {
        id: data.id,
        layoutNotes: data.layout_notes,
        sectionTags: data.section_tags ?? [],
      },
    });
  } catch (err) {
    console.error('Klaviyo style-guides update error:', err);
    return errors.internal(err instanceof Error ? err.message : 'Failed to update style guide');
  }
}

/**
 * DELETE /api/klaviyo/style-guides/[id]
 * Remove a saved style guide
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { error } = await supabase.from('email_style_guides').delete().eq('id', id);

    if (error) {
      console.error('Style guide delete error:', error);
      return errors.database(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Klaviyo style-guides delete error:', err);
    return errors.internal(err instanceof Error ? err.message : 'Failed to delete style guide');
  }
}
