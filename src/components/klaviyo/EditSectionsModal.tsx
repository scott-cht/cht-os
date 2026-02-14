'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { SectionTag, StyleGuide } from '@/components/klaviyo/types';

interface EditSectionsModalProps {
  guide: StyleGuide | null;
  layoutNotes: string;
  sectionTags: SectionTag[];
  saving: boolean;
  onLayoutNotesChange: (value: string) => void;
  onAddSectionTag: () => void;
  onUpdateSectionTag: (index: number, field: 'type' | 'description', value: string) => void;
  onRemoveSectionTag: (index: number) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditSectionsModal({
  guide,
  layoutNotes,
  sectionTags,
  saving,
  onLayoutNotesChange,
  onAddSectionTag,
  onUpdateSectionTag,
  onRemoveSectionTag,
  onClose,
  onSave,
}: EditSectionsModalProps) {
  if (!guide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Tag sections: {guide.name}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Tell the AI where to put products, category links, and CTAs so generated emails match your layout.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Layout notes (optional)</label>
            <textarea
              value={layoutNotes}
              onChange={(e) => onLayoutNotesChange(e.target.value)}
              placeholder="e.g. Product grid in main column, max 6 items. Category links in footer. Primary CTA above footer."
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 min-h-[80px]"
              rows={3}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Section tags (optional)</label>
              <Button variant="ghost" size="sm" onClick={onAddSectionTag}>Add section</Button>
            </div>
            <p className="text-xs text-zinc-500 mb-2">e.g. products (main grid), category_links (footer), cta (primary button)</p>
            <ul className="space-y-2">
              {sectionTags.map((tag, i) => (
                <li key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Type (e.g. products)"
                    value={tag.type}
                    onChange={(e) => onUpdateSectionTag(i, 'type', e.target.value)}
                    className="flex-1 min-w-0"
                  />
                  <Input
                    placeholder="Description"
                    value={tag.description ?? ''}
                    onChange={(e) => onUpdateSectionTag(i, 'description', e.target.value)}
                    className="flex-1 min-w-0"
                  />
                  <Button variant="ghost" size="sm" onClick={() => onRemoveSectionTag(i)}>Remove</Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
