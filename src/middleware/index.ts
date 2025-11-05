import { defineMiddleware, sequence } from "astro:middleware";
import { supabaseClient } from "../db/supabase.client";
import { getSupabaseSession } from "../lib/utils";
import { API_BASE_URL } from "../lib/constants";

const authenticate = defineMiddleware(async (context, next) => {
  const session = await getSupabaseSession(context);

  if (!session) {
    return context.redirect(`${API_BASE_URL}/onboarding/consent`, 302);
  }

  context.locals.session = session;
  return next();
});

export const onRequest = sequence(authenticate);

export async function checkAuth(request: Request): Promise<{ session: any } | { redirect: Response }> {
  const session = await getSupabaseSession({ request } as any);

  if (!session) {
    return {
      redirect: new Response(null, {
        status: 302,
        headers: {
          location: `${API_BASE_URL}/onboarding/consent`,
        },
      }),
    };
  }

  return { session };
}
