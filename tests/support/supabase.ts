import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types.ts";

type ProfilesMaybeSingleResponse = Awaited<
  ReturnType<ReturnType<ReturnType<ReturnType<SupabaseClient<Database>["from"]>["select"]>["eq"]>["maybeSingle"]>
>;

interface MaybeSingleFixture {
  data: ProfilesMaybeSingleResponse["data"];
  error: ProfilesMaybeSingleResponse["error"];
  status: ProfilesMaybeSingleResponse["status"];
}

interface SupabaseProfilesMock {
  supabase: SupabaseClient<Database>;
  maybeSingleMock: ReturnType<typeof vi.fn>;
}

export function createProfilesSupabaseMock(result: MaybeSingleFixture): SupabaseProfilesMock {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  const supabase = {
    from,
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    maybeSingleMock: maybeSingle,
  };
}
