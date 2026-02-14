'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { StyleGuide } from '@/components/klaviyo/types';

interface StyleGuidesCardProps {
  loadingGuides: boolean;
  styleGuides: StyleGuide[];
  klaviyoReady: boolean;
  onOpenPreview: (guide: StyleGuide) => void;
  onOpenEditSections: (guide: StyleGuide) => void;
  onDeleteStyleGuide: (id: string) => void;
  onOpenImportModal: () => void;
}

export function StyleGuidesCard({
  loadingGuides,
  styleGuides,
  klaviyoReady,
  onOpenPreview,
  onOpenEditSections,
  onDeleteStyleGuide,
  onOpenImportModal,
}: StyleGuidesCardProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Style guides</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Export emails from Klaviyo to use as references. Use <strong>Preview</strong> to view the email and <strong>Edit sections</strong> to tag where products, category links, and CTAs should go so generated emails match your layout.
      </p>
      {loadingGuides ? (
        <p className="text-sm text-zinc-500">Loading style guides...</p>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {styleGuides.length === 0 ? (
              <li className="text-sm text-zinc-500">No style guides yet. Import from Klaviyo to get started.</li>
            ) : (
              styleGuides.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{g.name}</span>
                    {g.subject && (
                      <span className="text-xs text-zinc-500 truncate hidden sm:inline max-w-[180px]">{g.subject}</span>
                    )}
                    {(g.layoutNotes || (g.sectionTags?.length ?? 0) > 0) && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0">Tagged</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => onOpenPreview(g)} title="Preview">
                      Preview
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onOpenEditSections(g)} title="Tag sections (products, category links)">
                      Edit sections
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteStyleGuide(g.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <Button onClick={onOpenImportModal} disabled={!klaviyoReady}>
            Import from Klaviyo
          </Button>
        </>
      )}
    </Card>
  );
}
