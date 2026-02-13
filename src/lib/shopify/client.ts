import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { createClient } from '@supabase/supabase-js';

const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN || '';

// Cache for the OAuth token
let cachedToken: string | null = null;
let tokenFetchedAt: number = 0;
const TOKEN_CACHE_MS = 60000; // Cache for 1 minute

/**
 * Get Shopify access token from Supabase (OAuth) or env var (fallback)
 */
async function getAccessToken(): Promise<string | null> {
  // Check env var first (for backwards compatibility)
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }
  
  // Check cache
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_CACHE_MS) {
    return cachedToken;
  }
  
  // Fetch from Supabase
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('provider', 'shopify')
      .eq('shop', shopifyDomain)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    cachedToken = data.access_token;
    tokenFetchedAt = Date.now();
    return cachedToken;
  } catch (error) {
    console.error('Failed to fetch Shopify token:', error);
    return null;
  }
}

/**
 * Check if Shopify is configured (has domain and token)
 */
export async function isShopifyConfigured(): Promise<boolean> {
  if (!shopifyDomain) return false;
  const token = await getAccessToken();
  return Boolean(token);
}

/**
 * Check if Shopify has basic config (for showing auth button)
 */
export function hasShopifyConfig(): boolean {
  return Boolean(
    shopifyDomain &&
    process.env.SHOPIFY_API_KEY &&
    process.env.SHOPIFY_API_SECRET
  );
}

/**
 * Initialize Shopify API client
 */
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: ['write_products', 'read_products', 'write_inventory', 'read_inventory', 'read_orders'],
  hostName: shopifyDomain?.replace('https://', '').replace('.myshopify.com', '') || '',
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: false,
});

/**
 * Create a session for Admin API requests
 * Returns null if Shopify is not configured
 */
export async function createAdminSession(): Promise<Session | null> {
  const token = await getAccessToken();
  
  if (!shopifyDomain || !token) {
    return null;
  }
  
  return new Session({
    id: `offline_${shopifyDomain}`,
    shop: shopifyDomain,
    state: '',
    isOnline: false,
    accessToken: token,
  });
}

/**
 * Get GraphQL client for Admin API
 * Returns null if Shopify is not configured
 */
export async function getGraphQLClient() {
  const session = await createAdminSession();
  
  if (!session) {
    console.warn('Shopify is not configured. Skipping GraphQL client creation.');
    return null;
  }
  
  return new shopify.clients.Graphql({ session });
}

/**
 * GraphQL mutation to create a draft product
 * IMPORTANT: Always creates with status: DRAFT per PRD requirements
 */
export const CREATE_PRODUCT_MUTATION = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        handle
        status
        variants(first: 1) {
          edges {
            node {
              id
              price
              sku
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL mutation to add images to a product
 */
export const ADD_PRODUCT_IMAGES_MUTATION = `
  mutation productAppendImages($input: ProductAppendImagesInput!) {
    productAppendImages(input: $input) {
      newImages {
        id
        src
        altText
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL query to fetch products with pagination
 * Used for importing products from Shopify into local system
 */
export const FETCH_PRODUCTS_QUERY = `
  query fetchProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          handle
          title
          descriptionHtml
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
          images(first: 20) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                barcode
              }
            }
          }
          metafields(first: 20) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to update a product
 * Used for syncing enriched content back to Shopify
 */
export const UPDATE_PRODUCT_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        handle
        descriptionHtml
        status
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL query to fetch a single product by ID
 */
export const FETCH_PRODUCT_BY_ID_QUERY = `
  query fetchProduct($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      descriptionHtml
      vendor
      productType
      tags
      status
      createdAt
      updatedAt
      images(first: 20) {
        edges {
          node {
            id
            url
            altText
            width
            height
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            inventoryQuantity
            barcode
          }
        }
      }
      metafields(first: 20) {
        edges {
          node {
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query to search Shopify orders for RMA intake.
 */
export const FETCH_ORDERS_QUERY = `
  query fetchOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          orderNumber
          processedAt
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          email
          phone
          lineItems(first: 10) {
            edges {
              node {
                id
                name
                sku
                customAttributes {
                  key
                  value
                }
                variant {
                  id
                  sku
                  barcode
                  product {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query to fetch complete details for a single Shopify order.
 */
export const FETCH_ORDER_BY_ID_QUERY = `
  query fetchOrderById($id: ID!) {
    order(id: $id) {
      id
      name
      orderNumber
      processedAt
      displayFinancialStatus
      displayFulfillmentStatus
      email
      phone
      note
      customer {
        id
        firstName
        lastName
        email
        phone
      }
      shippingAddress {
        name
        phone
        address1
        address2
        city
        province
        country
        zip
      }
      lineItems(first: 100) {
        edges {
          node {
            id
            name
            quantity
            sku
            customAttributes {
              key
              value
            }
            variant {
              id
              sku
              barcode
              product {
                id
                title
                handle
              }
            }
          }
        }
      }
    }
  }
`;
