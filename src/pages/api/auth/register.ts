import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../db/supabase.client';

/**
 * Registration API endpoint
 * Handles user sign up with email confirmation flow
 *
 * Note: Supabase sends a confirmation email by default.
 * Users must confirm their email before they can log in.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: 'Email i hasło są wymagane'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase server client with proper cookie handling
    const supabase = createSupabaseServerClient({
      cookies,
      headers: request.headers
    });

    // Attempt to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Email confirmation is enabled by default in Supabase
        // Users will receive a confirmation email
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Registration error:', error);

      // Map common Supabase errors to user-friendly messages
      let errorMessage = 'Wystąpił błąd podczas rejestracji';

      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('user already exists')) {
        errorMessage = 'Ten adres email jest już zarejestrowany';
      } else if (error.message.toLowerCase().includes('password')) {
        errorMessage = 'Hasło nie spełnia wymagań bezpieczeństwa';
      } else if (error.message.toLowerCase().includes('invalid email')) {
        errorMessage = 'Nieprawidłowy format adresu email';
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if email confirmation is required
    const needsEmailConfirmation = !data.session;

    return new Response(
      JSON.stringify({
        user: data.user,
        session: data.session,
        needsEmailConfirmation,
        message: needsEmailConfirmation
          ? 'Konto utworzone! Sprawdź swoją skrzynkę email, aby potwierdzić adres.'
          : 'Konto utworzone pomyślnie!'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Unexpected registration error:', err);
    return new Response(
      JSON.stringify({
        error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
