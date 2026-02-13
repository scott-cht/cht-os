import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  FETCH_ORDER_BY_ID_QUERY,
  getGraphQLClient,
  isShopifyConfigured,
} from '@/lib/shopify/client';

interface ShopifyOrderDetail {
  id: string;
  name: string;
  orderNumber: number;
  processedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  customer: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  shippingAddress: {
    name: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    zip: string | null;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        quantity: number;
        sku: string | null;
        customAttributes: Array<{ key: string; value: string }>;
        variant: {
          id: string;
          sku: string | null;
          barcode: string | null;
          product: {
            id: string;
            title: string;
            handle: string | null;
          };
        } | null;
      };
    }>;
  };
}

function toOrderGid(id: string): string {
  if (id.startsWith('gid://shopify/Order/')) {
    return id;
  }
  if (/^\d+$/.test(id)) {
    return `gid://shopify/Order/${id}`;
  }
  return id;
}

function extractSerialCandidates(order: ShopifyOrderDetail): string[] {
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
 * GET /api/rma/orders/[id]
 * Fetch a single Shopify order for RMA intake.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const orderGid = toOrderGid(id);
    const result = await graphqlClient.request(FETCH_ORDER_BY_ID_QUERY, {
      variables: { id: orderGid },
    });

    const data = result.data as { order?: ShopifyOrderDetail | null };
    if (!data.order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = data.order;
    const serialCandidates = extractSerialCandidates(order);

    const supabase = createServerClient();
    const inventoryLinks =
      serialCandidates.length > 0
        ? await supabase
            .from('inventory_items')
            .select('id, serial_number, brand, model')
            .in('serial_number', serialCandidates)
        : { data: [], error: null };
    const registryLinks =
      serialCandidates.length > 0
        ? await supabase
            .from('serial_registry')
            .select('id, serial_number, brand, model, rma_count')
            .in('serial_number', serialCandidates)
        : { data: [], error: null };

    if (inventoryLinks.error) {
      console.warn('RMA order detail inventory match warning:', inventoryLinks.error.message);
    }
    if (registryLinks.error) {
      console.warn('RMA order detail registry match warning:', registryLinks.error.message);
    }

    return NextResponse.json({
      order: {
        id: order.id,
        name: order.name,
        orderNumber: order.orderNumber,
        processedAt: order.processedAt,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        note: order.note,
        customer: {
          name: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || null,
          email: order.customer?.email || order.email,
          phone: order.customer?.phone || order.phone,
        },
        shippingAddress: order.shippingAddress,
        lineItems: order.lineItems.edges.map(({ node }) => ({
          id: node.id,
          name: node.name,
          quantity: node.quantity,
          sku: node.sku || node.variant?.sku || null,
          barcode: node.variant?.barcode || null,
          product: node.variant?.product
            ? {
                id: node.variant.product.id,
                title: node.variant.product.title,
                handle: node.variant.product.handle,
              }
            : null,
          customAttributes: node.customAttributes,
        })),
        serialCandidates,
      },
      matches: {
        inventory: inventoryLinks.data || [],
        registry: registryLinks.data || [],
      },
    });
  } catch (error) {
    console.error('RMA order detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
