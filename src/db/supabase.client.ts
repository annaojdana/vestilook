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

// Server-side Supabase client factory for Astro pages/middleware
// Uses cookies for session management
export function createSupabaseServerClient(context: {
  headers: Headers;
  cookies: AstroCookies;
}) {
  // Parse cookies from header
  function parseCookieHeader(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name) {
        cookies[name] = rest.join('=');
      }
    });

    return cookies;
  }

  const cookiesFromHeader = parseCookieHeader(context.headers.get('Cookie') ?? '');

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't use localStorage on server
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Forward cookies to Supabase
        ...Object.keys(cookiesFromHeader).reduce(
          (acc, key) => {
            if (key.startsWith('sb-')) {
              acc[key] = cookiesFromHeader[key];
            }
            return acc;
          },
          {} as Record<string, string>,
        ),
      },
    },
    // Custom cookie handling for server-side
    cookies: {
      get: (name: string) => cookiesFromHeader[name] ?? null,
      set: (name: string, value: string, options: any) => {
        context.cookies.set(name, value, {
          path: options.path ?? '/',
          maxAge: options.maxAge,
          httpOnly: options.httpOnly ?? true,
          secure: options.secure ?? true,
          sameSite: (options.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
        });
      },
      remove: (name: string, options: any) => {
        context.cookies.delete(name, {
          path: options.path ?? '/',
        });
      },
    },
  } as any);
}
