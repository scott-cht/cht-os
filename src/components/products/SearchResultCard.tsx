'use client';

import { Card } from '@/components/ui/Card';
import type { SearchResult } from '@/types';

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

export function SearchResultCard({ result, isSelected, onSelect }: SearchResultCardProps) {
  // Extract domain for display
  const displayDomain = result.domain.replace('www.', '');
  
  return (
    <Card 
      clickable 
      selected={isSelected} 
      onClick={onSelect}
      className="group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Domain badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`
              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${result.isAustralian 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }
            `}>
              {result.isAustralian && (
                <span className="mr-1">🇦🇺</span>
              )}
              {displayDomain}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {result.title}
          </h3>
          
          {/* Snippet */}
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {result.snippet}
          </p>
          
          {/* URL */}
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 truncate">
            {result.url}
          </p>
        </div>
        
        {/* Selection indicator */}
        <div className={`
          flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${isSelected 
            ? 'bg-emerald-500 border-emerald-500' 
            : 'border-zinc-300 dark:border-zinc-600 group-hover:border-emerald-400'
          }
        `}>
          {isSelected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </Card>
  );
}
