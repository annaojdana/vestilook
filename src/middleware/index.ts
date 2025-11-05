import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '../db/supabase.client';

/**
 * Authentication Middleware
 * Follows Supabase SSR best practices with proper session management
 */

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
  '/auth/update-password',
  '/auth/callback', // Email confirmation callback
  '/', // Landing page
];

// API endpoints that don't require authentication
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
];

// Protected paths that require authentication
const PROTECTED_PATHS = [
  '/onboarding/consent',
  '/onboarding/persona',
  '/generations',
  '/dashboard',
  '/profile',
];

// Auth paths where logged-in users should be redirected
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/reset-password'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Skip authentication for public API paths
  if (PUBLIC_API_PATHS.some((apiPath) => path.startsWith(apiPath))) {
    return next();
  }

  // Create Supabase server client with proper cookie handling (getAll/setAll)
  const supabase = createSupabaseServerClient({
    headers: context.request.headers,
    cookies: context.cookies,
  });

  // Add supabase client to context for use in pages
  context.locals.supabase = supabase;

  try {
    // IMPORTANT: Always get user session first before any other operations
    // This ensures proper JWT validation and session refresh
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Add user to context with proper structure
    if (user && !error) {
      context.locals.user = user;
    } else {
      context.locals.user = null;
    }

    // Check if path is protected
    const isProtectedPath = PROTECTED_PATHS.some((route) => path.startsWith(route));
    const isAuthPath = AUTH_PATHS.some((route) => path.startsWith(route));
    const isPublicPath = PUBLIC_PATHS.includes(path);

    // Redirect unauthenticated users from protected paths to login
    if (isProtectedPath && !user) {
      const redirectUrl = `/auth/login?redirect=${encodeURIComponent(path)}`;
      return context.redirect(redirectUrl, 302);
    }

    // Redirect authenticated users from auth pages to onboarding/dashboard
    if (isAuthPath && user) {
      return context.redirect('/onboarding/consent', 302);
    }

    // Allow public paths for everyone
    if (isPublicPath) {
      return next();
    }

    return next();
  } catch (err) {
    console.error('Middleware authentication error:', err);
    // On error, allow public paths, redirect protected paths
    const isProtectedPath = PROTECTED_PATHS.some((route) => path.startsWith(route));
    if (isProtectedPath) {
      return context.redirect('/auth/login', 302);
    }
    return next();
  }
});
