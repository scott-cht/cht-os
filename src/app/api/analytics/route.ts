import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Analytics API Endpoint
 * Returns aggregated inventory statistics for dashboard charts
 */

export interface AnalyticsData {
  summary: {
    totalItems: number;
    totalValue: number;
    averagePrice: number;
    averageMargin: number;
    pendingSyncs: number;
    syncedItems: number;
    errorItems: number;
  };
  byListingType: {
    type: string;
    label: string;
    count: number;
    value: number;
  }[];
  bySyncStatus: {
    status: string;
    label: string;
    count: number;
  }[];
  byCondition: {
    grade: string;
    label: string;
    count: number;
  }[];
  timeline: {
    date: string;
    itemsAdded: number;
    totalValue: number;
  }[];
}

export async function GET() {
  try {
    const supabase = createServerClient();

    // Fetch all inventory items
    const { data: items, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('is_archived', false);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch analytics data', details: error.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      // Return empty analytics
      return NextResponse.json({
        summary: {
          totalItems: 0,
          totalValue: 0,
          averagePrice: 0,
          averageMargin: 0,
          pendingSyncs: 0,
          syncedItems: 0,
          errorItems: 0,
        },
        byListingType: [],
        bySyncStatus: [],
        byCondition: [],
        timeline: [],
      });
    }

    // Calculate summary stats
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.sale_price || 0), 0);
    const averagePrice = totalValue / totalItems;
    
    // Calculate average margin (only for items with cost price)
    const itemsWithMargin = items.filter(i => i.cost_price && i.sale_price && i.cost_price > 0);
    const averageMargin = itemsWithMargin.length > 0
      ? itemsWithMargin.reduce((sum, item) => {
          const margin = ((item.sale_price - item.cost_price!) / item.sale_price) * 100;
          return sum + margin;
        }, 0) / itemsWithMargin.length
      : 0;

    const pendingSyncs = items.filter(i => i.sync_status === 'pending').length;
    const syncedItems = items.filter(i => i.sync_status === 'synced').length;
    const errorItems = items.filter(i => i.sync_status === 'error').length;

    // Group by listing type
    const typeLabels: Record<string, string> = {
      new: 'New Retail',
      trade_in: 'Trade-In',
      ex_demo: 'Ex-Demo',
    };
    const byListingType = Object.entries(
      items.reduce((acc, item) => {
        const type = item.listing_type || 'unknown';
        if (!acc[type]) {
          acc[type] = { count: 0, value: 0 };
        }
        acc[type].count++;
        acc[type].value += item.sale_price || 0;
        return acc;
      }, {} as Record<string, { count: number; value: number }>)
    ).map(([type, data]) => ({
      type,
      label: typeLabels[type] || type,
      count: data.count,
      value: data.value,
    }));

    // Group by sync status
    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      synced: 'Synced',
      syncing: 'Syncing',
      error: 'Error',
    };
    const bySyncStatus = Object.entries(
      items.reduce((acc, item) => {
        const status = item.sync_status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([status, count]) => ({
      status,
      label: statusLabels[status] || status,
      count,
    }));

    // Group by condition grade
    const gradeLabels: Record<string, string> = {
      mint: 'Mint',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
    };
    const byCondition = Object.entries(
      items.reduce((acc, item) => {
        const grade = item.condition_grade || 'not_graded';
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .filter(([grade]) => grade !== 'not_graded')
      .map(([grade, count]) => ({
        grade,
        label: gradeLabels[grade] || grade,
        count,
      }));

    // Timeline - last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const timelineMap = new Map<string, { itemsAdded: number; totalValue: number }>();
    
    // Initialize all days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      timelineMap.set(dateStr, { itemsAdded: 0, totalValue: 0 });
    }

    // Fill in actual data
    items.forEach(item => {
      const createdDate = new Date(item.created_at);
      if (createdDate >= thirtyDaysAgo) {
        const dateStr = createdDate.toISOString().split('T')[0];
        const existing = timelineMap.get(dateStr);
        if (existing) {
          existing.itemsAdded++;
          existing.totalValue += item.sale_price || 0;
        }
      }
    });

    const timeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({
        date,
        itemsAdded: data.itemsAdded,
        totalValue: data.totalValue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: AnalyticsData = {
      summary: {
        totalItems,
        totalValue,
        averagePrice,
        averageMargin,
        pendingSyncs,
        syncedItems,
        errorItems,
      },
      byListingType,
      bySyncStatus,
      byCondition,
      timeline,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}
