import type { AstroCookies } from "astro";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

const resolvedSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
if (!resolvedSupabaseUrl) {
  throw new Error("Brak konfiguracji SUPABASE_URL/PUBLIC_SUPABASE_URL. Uzupełnij zmienne środowiskowe.");
}

const resolvedSupabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_KEY;
if (!resolvedSupabaseKey) {
  throw new Error("Brak konfiguracji SUPABASE_KEY/PUBLIC_SUPABASE_ANON_KEY. Uzupełnij zmienne środowiskowe.");
}

const supabaseUrl = resolvedSupabaseUrl;
const supabaseAnonKey = resolvedSupabaseKey;

const isSecureEnvironment =
  Boolean(import.meta.env?.PROD) || (typeof process !== "undefined" && process.env.NODE_ENV === "production");

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const cookieOptions = {
  path: "/",
  secure: isSecureEnvironment,
  httpOnly: true,
  sameSite: "lax" as const,
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

export function createSupabaseServerClient(context: { headers: Headers; cookies: AstroCookies }) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
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
