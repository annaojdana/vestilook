/**
 * Maps Supabase Auth errors to user-friendly Polish messages
 * Based on auth-spec.md section 2.4
 */
export function mapSupabaseAuthError(error: { message: string; status?: number }): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Nieprawidłowy email lub hasło';
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'Ten adres email jest już zarejestrowany';
  }

  if (message.includes('email not confirmed')) {
    return 'Potwierdź swój adres email, aby się zalogować';
  }

  if (message.includes('password') && message.includes('weak')) {
    return 'Hasło jest zbyt słabe. Użyj silniejszego hasła.';
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';
  }

  if (message.includes('expired') || message.includes('invalid')) {
    return 'Link wygasł lub jest nieprawidłowy';
  }

  if (message.includes('network') || message.includes('connection')) {
    return 'Wystąpił problem z połączeniem. Spróbuj ponownie.';
  }

  // Default error message
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}

/**
 * Handles authentication errors that require user logout
 * Returns true if error was handled (logout triggered)
 */
export async function handleAuthError(
  error: any,
  supabaseClient: any,
  onRedirect: (path: string) => void,
): Promise<boolean> {
  if (
    error?.status === 401 ||
    error?.message?.toLowerCase().includes('unauthorized') ||
    error?.message?.toLowerCase().includes('session')
  ) {
    await supabaseClient.auth.signOut();
    const currentPath = window.location.pathname;
    onRedirect(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
    return true;
  }
  return false;
}
