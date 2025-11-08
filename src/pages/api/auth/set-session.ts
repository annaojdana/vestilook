import type { APIRoute } from "astro";
import type { Session } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/db/supabase.client.ts";

interface SetSessionPayload {
  event?: "SIGNED_IN" | "SIGNED_OUT";
  session?: Pick<Session, "access_token" | "refresh_token">;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient({
    headers: request.headers,
    cookies,
  });

  try {
    const body = (await request.json()) as SetSessionPayload;

    if (body.event === "SIGNED_OUT") {
      await supabase.auth.signOut();
      return new Response(null, { status: 204 });
    }

    if (body.event === "SIGNED_IN" && body.session?.access_token && body.session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: body.session.access_token,
        refresh_token: body.session.refresh_token,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: "set_session_failed", message: error.message }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(null, { status: 204 });
    }

    return new Response(
      JSON.stringify({ error: "invalid_payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[set-session] Failed to process payload.", error);
    return new Response(
      JSON.stringify({ error: "unknown_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
