import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/response';

/**
 * GET /api/klaviyo/style-guides
 * List saved email style guides from DB
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: rows, error } = await supabase
      .from('email_style_guides')
      .select('id, name, subject, html, plain_text, source_type, source_id, created_at, layout_notes, section_tags')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Style guides fetch error:', error);
      return errors.database(error.message);
    }

    const styleGuides = (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      html: r.html,
      plainText: r.plain_text,
      sourceType: r.source_type,
      sourceId: r.source_id,
      createdAt: r.created_at,
      layoutNotes: r.layout_notes ?? null,
      sectionTags: r.section_tags ?? [],
    }));

    return NextResponse.json({ styleGuides });
  } catch (err) {
    console.error('Klaviyo style-guides list error:', err);
    return errors.internal(err instanceof Error ? err.message : 'Failed to list style guides');
  }
}
