import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

// Client-side Supabase client for React components
// Uses localStorage for session persistence
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Persist session in localStorage (client-side only)
    autoRefreshToken: true, // Auto-refresh tokens
    detectSessionInUrl: true, // Detect session in URL (for magic links)
  },
});

// Cookie options for server-side session management
export const cookieOptions = {
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'lax' as const,
};

// Parse cookie header into array of {name, value} objects
function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) return [];

  return cookieHeader.split(';').map((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    return { name, value: rest.join('=') };
  });
}

/**
 * Server-side Supabase client factory for Astro pages/middleware
 * IMPORTANT: Uses getAll/setAll pattern for cookie management as per security best practices
 * NEVER use individual get/set/remove methods
 */
export function createSupabaseServerClient(context: {
  headers: Headers;
  cookies: AstroCookies;
}) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't use localStorage on server
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    cookies: {
      // IMPORTANT: Use getAll pattern - returns all cookies at once
      getAll() {
        return parseCookieHeader(context.headers.get('Cookie') ?? '');
      },
      // IMPORTANT: Use setAll pattern - sets multiple cookies at once
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, {
            ...cookieOptions,
            ...options,
          });
        });
      },
    },
  });
}
