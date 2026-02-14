import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  FETCH_ORDERS_QUERY,
  getGraphQLClient,
  isShopifyConfigured,
} from '@/lib/shopify/client';

interface ShopifyOrderNode {
  id: string;
  name: string;
  legacyResourceId: string | null;
  processedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  email: string | null;
  phone: string | null;
  shippingAddress: {
    name: string | null;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        sku: string | null;
        customAttributes: Array<{ key: string; value: string }>;
        variant: {
          sku: string | null;
          barcode: string | null;
          product: { id: string; title: string };
        } | null;
      };
    }>;
  };
}

function extractSerialCandidates(order: ShopifyOrderNode): string[] {
  const keys = ['serial', 'serial_number', 'sn', 's/n'];
  const candidates = new Set<string>();

  order.lineItems.edges.forEach(({ node }) => {
    node.customAttributes.forEach((attr) => {
      if (keys.includes(attr.key.trim().toLowerCase()) && attr.value?.trim()) {
        candidates.add(attr.value.trim());
      }
    });
    if (node.variant?.barcode?.trim()) {
      candidates.add(node.variant.barcode.trim());
    }
  });

  return Array.from(candidates);
}

function parseOrderNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function getStoredShopifyScope(shop: string): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data } = await supabase
    .from('oauth_tokens')
    .select('scope')
    .eq('provider', 'shopify')
    .eq('shop', shop)
    .maybeSingle();
  return data?.scope || null;
}

/**
 * GET /api/rma/orders
 * Search Shopify orders for RMA intake.
 */
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.shopify, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    if (!(await isShopifyConfigured())) {
      return NextResponse.json(
        { error: 'Shopify is not configured' },
        { status: 503 }
      );
    }

    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const hasStaticAdminToken = Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
    if (shop && !hasStaticAdminToken) {
      const scope = await getStoredShopifyScope(shop);
      if (scope && !scope.split(',').map((item) => item.trim()).includes('read_orders')) {
        return NextResponse.json(
          {
            error: 'Shopify token is missing read_orders scope. Re-authorize via /api/shopify/auth and approve order scopes.',
          },
          { status: 403 }
        );
      }
    }

    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) {
      return NextResponse.json(
        { error: 'Failed to create Shopify client' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const after = searchParams.get('after');
    const requestedLimitRaw = Number.parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(Number.isNaN(requestedLimitRaw) ? 20 : requestedLimitRaw, 1), 50);
    const primaryQuery = search.length > 0 ? search : 'status:any';
    let result;
    try {
      result = await graphqlClient.request(FETCH_ORDERS_QUERY, {
        variables: {
          first: limit,
          after: after || null,
          query: primaryQuery,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isAccessDenied = message.toLowerCase().includes('access denied');
      if (!isAccessDenied || primaryQuery === 'status:any') {
        throw error;
      }

      // Fallback for stores where text search over restricted fields is denied:
      // fetch recent orders and filter locally.
      result = await graphqlClient.request(FETCH_ORDERS_QUERY, {
        variables: {
          first: limit,
          after: after || null,
          query: 'status:any',
        },
      });
    }

    const data = result.data as {
      orders?: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        edges: Array<{ node: ShopifyOrderNode }>;
      };
    };

    const allOrders = data.orders?.edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      orderNumber: parseOrderNumber(node.legacyResourceId),
      processedAt: node.processedAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      customerName: node.shippingAddress?.name || null,
      customerEmail: node.email,
      customerPhone: node.phone,
      lineItemCount: node.lineItems.edges.length,
      serialCandidates: extractSerialCandidates(node),
    })) || [];
    const searchTerm = search.toLowerCase();
    const orders = searchTerm
      ? allOrders.filter((order) => {
          const haystack = [
            order.name,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.serialCandidates.join(' '),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(searchTerm);
        })
      : allOrders;

    return NextResponse.json({
      orders,
      pagination: {
        hasNextPage: data.orders?.pageInfo.hasNextPage || false,
        endCursor: data.orders?.pageInfo.endCursor || null,
      },
    });
  } catch (error) {
    console.error('RMA order search error:', error);
    const message = error instanceof Error ? error.message : 'Failed to search orders';
    if (message.toLowerCase().includes('access denied') && message.toLowerCase().includes('orders')) {
      return NextResponse.json(
        {
          error: 'Access denied for orders field. Re-authorize Shopify app via /api/shopify/auth with read_orders scope.',
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
