import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/db/database.types";

function getEnv(name: string): string | undefined {
  return process.env[name];
}

export default async function globalTeardown() {
  const email = getEnv("E2E_USERNAME");
  const password = getEnv("E2E_PASSWORD");
  const userId = getEnv("E2E_USERNAME_ID");
  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PUBLIC_SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_KEY") ?? getEnv("PUBLIC_SUPABASE_ANON_KEY");

  if (!email || !password || !userId || !supabaseUrl || !supabaseKey) {
    console.warn("[global-teardown] Pomijam czyszczenie, brak wymaganych zmiennych środowiskowych.");
    return;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    console.error("[global-teardown] Nie udało się zalogować w Supabase.", error);
    return;
  }

  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000),
    token_type: data.session.token_type,
    user: data.session.user,
  });

  const { error: deleteError } = await supabase
    .from("vton_generations")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[global-teardown] Błąd czyszczenia rekordów generacji.", deleteError);
  }
}
