'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';

interface PriceHistoryEntry {
  id: string;
  cost_price: number | null;
  rrp_aud: number | null;
  sale_price: number | null;
  discount_percent: number | null;
  change_type: string;
  change_reason: string | null;
  created_at: string;
}

interface PriceTrends {
  totalChanges: number;
  firstPrice: number | null;
  currentPrice: number | null;
  highestPrice: number | null;
  lowestPrice: number | null;
  averagePrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
}

interface PriceHistoryProps {
  itemId: string;
}

/**
 * Price History Component
 * 
 * Displays price change history for an inventory item.
 */
export function PriceHistory({ itemId }: PriceHistoryProps) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [trends, setTrends] = useState<PriceTrends | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/inventory/${itemId}/price-history?limit=20`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setHistory(data.history || []);
          setTrends(data.trends || null);
        }
      } catch {
        setError('Failed to load price history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [itemId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'create': return 'Initial';
      case 'manual': return 'Manual';
      case 'auto_discount': return 'Auto';
      case 'bulk_update': return 'Bulk';
      case 'import': return 'Import';
      default: return type;
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'manual': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'auto_discount': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'bulk_update': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-8 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-zinc-500">{error}</p>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-zinc-500">No price history available</p>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header */}
      <div 
        className="p-4 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h3 className="font-semibold text-zinc-900 dark:text-white">
            Price History
          </h3>
          <span className="text-xs text-zinc-500">
            ({history.length} change{history.length !== 1 ? 's' : ''})
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Summary */}
      {trends && (
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Initial</p>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(trends.firstPrice)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Current</p>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(trends.currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Range</p>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(trends.lowestPrice)} — {formatCurrency(trends.highestPrice)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Change</p>
              <p className={`font-semibold ${
                trends.priceChangePercent !== null
                  ? trends.priceChangePercent > 0
                    ? 'text-emerald-600'
                    : trends.priceChangePercent < 0
                    ? 'text-red-600'
                    : 'text-zinc-900 dark:text-white'
                  : 'text-zinc-900 dark:text-white'
              }`}>
                {trends.priceChange !== null ? (
                  <>
                    {trends.priceChange >= 0 ? '+' : ''}
                    {formatCurrency(trends.priceChange)}
                    <span className="text-xs ml-1">
                      ({trends.priceChangePercent?.toFixed(1)}%)
                    </span>
                  </>
                ) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      {isExpanded && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
          {history.map((entry, index) => {
            const prevEntry = history[index + 1];
            const priceChange = prevEntry && entry.sale_price !== null && prevEntry.sale_price !== null
              ? entry.sale_price - prevEntry.sale_price
              : null;

            return (
              <div key={entry.id} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getChangeTypeColor(entry.change_type)}`}>
                      {getChangeTypeLabel(entry.change_type)}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {formatCurrency(entry.sale_price)}
                    </span>
                    {priceChange !== null && priceChange !== 0 && (
                      <span className={`text-xs ${priceChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ({priceChange > 0 ? '+' : ''}{formatCurrency(priceChange)})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                {entry.change_reason && (
                  <p className="text-xs text-zinc-500 mt-1 ml-16">
                    {entry.change_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
