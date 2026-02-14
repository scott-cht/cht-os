'use client';

import { Button } from '@/components/ui/Button';
import type { StyleGuide } from '@/components/klaviyo/types';

interface StyleGuidePreviewModalProps {
  guide: StyleGuide | null;
  safeHtml: string;
  onClose: () => void;
}

export function StyleGuidePreviewModal({ guide, safeHtml, onClose }: StyleGuidePreviewModalProps) {
  if (!guide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Preview: {guide.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4 space-y-2 border-b border-zinc-200 dark:border-zinc-700">
          {guide.subject && (
            <p className="text-sm"><span className="font-medium text-zinc-600 dark:text-zinc-400">Subject:</span> <span className="text-zinc-900 dark:text-white">{guide.subject}</span></p>
          )}
          {(guide.layoutNotes || (guide.sectionTags?.length ?? 0) > 0) && (
            <div className="text-xs text-zinc-500">
              {guide.layoutNotes && <p>Layout: {guide.layoutNotes}</p>}
              {guide.sectionTags?.length ? (
                <p>Sections: {guide.sectionTags.map((t) => `${t.type}${t.description ? ` (${t.description})` : ''}`).join(', ')}</p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-950 text-sm prose prose-zinc dark:prose-invert max-w-none max-h-[60vh] overflow-auto"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      </div>
    </div>
  );
}
