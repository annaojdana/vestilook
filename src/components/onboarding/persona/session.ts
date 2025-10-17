import { supabaseClient } from "@/db/supabase.client.ts";

export type AccessTokenErrorCode = "unauthorized";

export interface AccessTokenError {
  code: AccessTokenErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export async function requireAccessToken(): Promise<string> {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw <AccessTokenError>{
      code: "unauthorized",
      message: "Nie udało się odczytać sesji użytkownika.",
      details: { cause: error.message },
    };
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw <AccessTokenError>{
      code: "unauthorized",
      message: "Brak aktywnej sesji użytkownika.",
    };
  }

  return accessToken;
}

export function isAccessTokenError(error: unknown): error is AccessTokenError {
  return Boolean(error && typeof error === "object" && "code" in error && (error as AccessTokenError).code === "unauthorized");
}
