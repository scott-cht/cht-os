import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  FETCH_ORDERS_QUERY,
  getGraphQLClient,
  isShopifyConfigured,
} from '@/lib/shopify/client';

interface ShopifyOrderNode {
  id: string;
  name: string;
  orderNumber: number;
  processedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  email: string | null;
  phone: string | null;
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
    const query = search.length > 0 ? search : 'status:any';

    const result = await graphqlClient.request(FETCH_ORDERS_QUERY, {
      variables: {
        first: limit,
        after: after || null,
        query,
      },
    });

    const data = result.data as {
      orders?: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        edges: Array<{ node: ShopifyOrderNode }>;
      };
    };

    const orders = data.orders?.edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      orderNumber: node.orderNumber,
      processedAt: node.processedAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      customerName: [node.customer?.firstName, node.customer?.lastName].filter(Boolean).join(' ') || null,
      customerEmail: node.customer?.email || node.email,
      customerPhone: node.customer?.phone || node.phone,
      lineItemCount: node.lineItems.edges.length,
      serialCandidates: extractSerialCandidates(node),
    })) || [];

    return NextResponse.json({
      orders,
      pagination: {
        hasNextPage: data.orders?.pageInfo.hasNextPage || false,
        endCursor: data.orders?.pageInfo.endCursor || null,
      },
    });
  } catch (error) {
    console.error('RMA order search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search orders' },
      { status: 500 }
    );
  }
}
