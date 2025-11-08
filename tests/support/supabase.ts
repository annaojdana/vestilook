import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/db/database.types.ts";

type ProfilesMaybeSingleResponse = Awaited<
  ReturnType<ReturnType<ReturnType<ReturnType<SupabaseClient<Database>["from"]>["select"]>["eq"]>["maybeSingle"]>
>;

interface MaybeSingleFixture {
  data: ProfilesMaybeSingleResponse["data"];
  error: ProfilesMaybeSingleResponse["error"];
  status: ProfilesMaybeSingleResponse["status"];
}

interface InsertFixture {
  data: Tables<"profiles"> | null;
  error: { message: string; code?: string } | null;
  status?: number;
}

type MaybeSingleInput = MaybeSingleFixture | MaybeSingleFixture[];

interface SupabaseProfilesMockOptions {
  insert?: InsertFixture | (() => InsertFixture | Promise<InsertFixture> | null);
}

interface SupabaseProfilesMock {
  supabase: SupabaseClient<Database>;
  maybeSingleMock: ReturnType<typeof vi.fn>;
  insertMock: ReturnType<typeof vi.fn>;
  singleMock: ReturnType<typeof vi.fn>;
}

export function createProfilesSupabaseMock(
  result: MaybeSingleInput,
  options: SupabaseProfilesMockOptions = {},
): SupabaseProfilesMock {
  const responses = Array.isArray(result) ? [...result] : [result];
  const maybeSingle = vi.fn(async () => {
    const next = responses.shift() ?? responses[responses.length - 1];
    return next;
  });

  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  const resolveInsertResult = async (): Promise<InsertFixture | null | undefined> => {
    if (typeof options.insert === "function") {
      return await options.insert();
    }
    return options.insert ?? null;
  };

  const single = vi.fn(async () => (await resolveInsertResult()) ?? { data: null, error: null, status: 201 });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const from = vi.fn(() => ({
    select,
    insert,
  }));

  const supabase = {
    from,
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    maybeSingleMock: maybeSingle,
    insertMock: insert,
    singleMock: single,
  };
}
