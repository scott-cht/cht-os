import { NextRequest, NextResponse } from 'next/server';
import { getGraphQLClient, isShopifyConfigured } from '@/lib/shopify/client';

const RETURNS_TOPICS = ['RETURNS_REQUEST', 'RETURNS_UPDATE'] as const;

const LIST_WEBHOOKS_QUERY = `
  query listReturnWebhooks($first: Int!, $topics: [WebhookSubscriptionTopic!]) {
    webhookSubscriptions(first: $first, topics: $topics) {
      edges {
        node {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
      }
    }
  }
`;

const CREATE_WEBHOOK_MUTATION = `
  mutation createReturnWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
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

const DELETE_WEBHOOK_MUTATION = `
  mutation deleteWebhook($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`;

function getCallbackUrl(request: NextRequest): string {
  const explicit = process.env.SHOPIFY_RETURNS_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const base = explicit || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  return `${base.replace(/\/$/, '')}/api/shopify/webhooks/returns`;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isShopifyConfigured())) {
      return NextResponse.json({ error: 'Shopify is not configured' }, { status: 503 });
    }

    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) {
      return NextResponse.json({ error: 'Failed to create Shopify GraphQL client' }, { status: 500 });
    }

    const callbackUrl = getCallbackUrl(request);

    const existingResponse = await graphqlClient.request(LIST_WEBHOOKS_QUERY, {
      variables: {
        first: 50,
        topics: RETURNS_TOPICS,
      },
    });
    const existingData = existingResponse.data as {
      webhookSubscriptions?: {
        edges?: Array<{
          node: {
            id: string;
            topic: string;
            endpoint: { __typename: string; callbackUrl?: string };
          };
        }>;
      };
    };

    const allExisting = (existingData.webhookSubscriptions?.edges || []).map((edge) => edge.node);
    const deletedIds: string[] = [];

    // Keep only one subscription per topic for our callback URL.
    for (const node of allExisting) {
      const nodeUrl = node.endpoint?.callbackUrl || '';
      if (nodeUrl !== callbackUrl) {
        const deleteResponse = await graphqlClient.request(DELETE_WEBHOOK_MUTATION, {
          variables: { id: node.id },
        });
        const deleteData = deleteResponse.data as {
          webhookSubscriptionDelete?: {
            deletedWebhookSubscriptionId?: string | null;
            userErrors?: Array<{ message: string }>;
          };
        };
        const deleteErrors = deleteData.webhookSubscriptionDelete?.userErrors || [];
        if (deleteErrors.length === 0 && deleteData.webhookSubscriptionDelete?.deletedWebhookSubscriptionId) {
          deletedIds.push(deleteData.webhookSubscriptionDelete.deletedWebhookSubscriptionId);
        }
      }
    }

    const created: Array<{ id: string; topic: string; callbackUrl: string | null }> = [];
    const errors: Array<{ topic: string; message: string }> = [];

    for (const topic of RETURNS_TOPICS) {
      const alreadyExists = allExisting.some(
        (node) => node.topic === topic && node.endpoint?.callbackUrl === callbackUrl
      );
      if (alreadyExists) {
        continue;
      }

      const createResponse = await graphqlClient.request(CREATE_WEBHOOK_MUTATION, {
        variables: {
          topic,
          webhookSubscription: {
            callbackUrl,
            format: 'JSON',
          },
        },
      });
      const createData = createResponse.data as {
        webhookSubscriptionCreate?: {
          webhookSubscription?: {
            id: string;
            topic: string;
            endpoint: { callbackUrl?: string };
          } | null;
          userErrors?: Array<{ message: string }>;
        };
      };
      const userErrors = createData.webhookSubscriptionCreate?.userErrors || [];
      if (userErrors.length > 0) {
        userErrors.forEach((error) => errors.push({ topic, message: error.message }));
        continue;
      }

      const webhook = createData.webhookSubscriptionCreate?.webhookSubscription;
      if (webhook) {
        created.push({
          id: webhook.id,
          topic: webhook.topic,
          callbackUrl: webhook.endpoint?.callbackUrl || null,
        });
      }
    }

    const finalResponse = await graphqlClient.request(LIST_WEBHOOKS_QUERY, {
      variables: {
        first: 50,
        topics: RETURNS_TOPICS,
      },
    });
    const finalData = finalResponse.data as {
      webhookSubscriptions?: {
        edges?: Array<{
          node: {
            id: string;
            topic: string;
            endpoint: { callbackUrl?: string };
          };
        }>;
      };
    };

    return NextResponse.json({
      success: errors.length === 0,
      callbackUrl,
      deletedIds,
      created,
      errors,
      subscriptions: (finalData.webhookSubscriptions?.edges || []).map((edge) => edge.node),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register Shopify return webhooks' },
      { status: 500 }
    );
  }
}
