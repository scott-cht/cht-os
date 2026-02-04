'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  clickable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', selected, clickable, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-xl border bg-white dark:bg-zinc-900 p-5 transition-all
          ${clickable ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700' : ''}
          ${selected 
            ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-md' 
            : 'border-zinc-200 dark:border-zinc-800'
          }
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
