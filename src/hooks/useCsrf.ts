'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * CSRF Token Hook
 * 
 * Fetches and manages CSRF token for protected API requests.
 * Automatically includes token in state-changing requests.
 */

let globalToken: string | null = null;
let fetchPromise: Promise<string> | null = null;

export function useCsrf() {
  const [token, setToken] = useState<string | null>(globalToken);
  const [isLoading, setIsLoading] = useState(!globalToken);

  useEffect(() => {
    // If we already have a token, nothing to fetch
    if (globalToken) {
      return;
    }

    // If there's already a fetch in progress, wait for it
    if (fetchPromise) {
      fetchPromise.then((t) => {
        setToken(t);
        setIsLoading(false);
      });
      return;
    }

    // Fetch the token
    fetchPromise = fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => {
        globalToken = data.token;
        setToken(data.token);
        setIsLoading(false);
        return data.token;
      })
      .catch(() => {
        setIsLoading(false);
        return '';
      })
      .finally(() => {
        fetchPromise = null;
      });
  }, []);

  // Helper to make CSRF-protected fetch requests
  const csrfFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Ensure we have a token
      let csrfToken = token || globalToken;
      
      if (!csrfToken) {
        const response = await fetch('/api/csrf');
        const data = await response.json();
        csrfToken = data.token;
        globalToken = csrfToken;
        setToken(csrfToken);
      }

      // Add CSRF token to headers for non-GET requests
      const method = options.method?.toUpperCase() || 'GET';
      const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      const headers = new Headers(options.headers);
      
      if (isStateChanging && csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [token]
  );

  return {
    token,
    isLoading,
    csrfFetch,
  };
}

/**
 * Standalone function to get CSRF headers
 * Useful for non-hook contexts
 */
export async function getCsrfHeaders(): Promise<Record<string, string>> {
  if (!globalToken) {
    const response = await fetch('/api/csrf');
    const data = await response.json();
    globalToken = data.token;
  }
  
  return {
    'X-CSRF-Token': globalToken || '',
  };
}
