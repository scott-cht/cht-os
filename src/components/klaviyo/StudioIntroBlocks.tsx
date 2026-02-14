'use client';

import { Card } from '@/components/ui/Card';

interface StudioIntroBlocksProps {
  klaviyoReady: boolean;
}

export function StudioIntroBlocks({ klaviyoReady }: StudioIntroBlocksProps) {
  return (
    <>
      {!klaviyoReady && (
        <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Connect Klaviyo by adding <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">KLAVIYO_PRIVATE_API_KEY</code> to your <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">.env.local</code>.
          </p>
        </Card>
      )}

      <Card className="p-5 border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">How it works</h2>
        <ol className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2 list-decimal list-inside">
          <li><strong>Import from Klaviyo</strong> — Save your best campaigns or templates as &quot;style guides&quot;. We store the subject and HTML so the AI can match your look and tone.</li>
          <li><strong>Optional: tag sections</strong> — Use &quot;Edit sections&quot; to say where products, category links, and CTAs go (e.g. &quot;Product grid in main column&quot;). This helps the AI keep the same layout when it swaps in new products.</li>
          <li><strong>Create a new email</strong> — Select products (or use the filter), choose one style guide, and set an intent (e.g. &quot;New arrivals&quot;). Click <strong>Generate email</strong>. The AI writes a new subject and body that match your style but feature the selected products.</li>
          <li><strong>Preview &amp; push</strong> — Review the result, copy it, or push it to Klaviyo as a new template (and optionally a draft campaign). You can then edit or schedule in Klaviyo as usual.</li>
        </ol>
      </Card>
    </>
  );
}
