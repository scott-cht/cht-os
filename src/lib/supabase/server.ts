import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client for server-side usage
 * Uses service role key for admin operations
 * 
 * Note: Using untyped client until Supabase types are generated
 * Run `npx supabase gen types typescript` to generate types
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase server environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Broadcast a status update via Supabase Realtime
 */
export async function broadcastStatusUpdate(
  productId: string,
  phase: string,
  status: string,
  message: string
) {
  const supabase = createServerClient();
  
  const channel = supabase.channel(`product:${productId}`);
  
  await channel.send({
    type: 'broadcast',
    event: 'status_update',
    payload: {
      productId,
      phase,
      status,
      message,
      timestamp: new Date().toISOString(),
    },
  });
}
