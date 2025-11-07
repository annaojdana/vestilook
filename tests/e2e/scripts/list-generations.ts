import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../../../src/db/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak wymaganej zmiennej środowiskowej: ${name}`);
  }
  return value;
}

async function main() {
  const email = requireEnv("E2E_USERNAME");
  const password = requireEnv("E2E_PASSWORD");
  const userId = requireEnv("E2E_USERNAME_ID");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_KEY");

  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Nie udało się zalogować do Supabase: ${error?.message ?? "brak danych"}`);
  }

  await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000),
    token_type: data.session.token_type,
    user: data.session.user,
  });

  const { data: generations, error: queryError } = await client
    .from("vton_generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (queryError) {
    throw new Error(`Błąd pobierania rekordów: ${queryError.message}`);
  }

  console.log(`Znaleziono ${generations?.length ?? 0} rekordów dla użytkownika ${userId}.`);
  if ((generations?.length ?? 0) > 0) {
    console.table(
      generations?.map((entry) => ({
        id: entry.id,
        status: entry.status,
        created_at: entry.created_at,
        expires_at: entry.expires_at,
      })) ?? []
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
