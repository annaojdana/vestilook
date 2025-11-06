import { describe, expect, it, beforeEach, vi } from "vitest";

import type { Tables } from "@/db/database.types.ts";
import { getProfile, ProfileForbiddenError, ProfileServiceError } from "@/lib/profile-service.ts";
import { createProfilesSupabaseMock } from "../../tests/support/supabase.ts";

const baseRow: Tables<"profiles"> = {
  user_id: "user-123",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-05T12:00:00.000Z",
  persona_path: "users/user-123/persona.png",
  consent_version: "v1",
  consent_accepted_at: "2024-01-02T00:00:00.000Z",
  free_generation_quota: 5,
  free_generation_used: 2,
  quota_renewal_at: "2024-02-01T00:00:00.000Z",
  cloth_path: "users/user-123/garments/latest.png",
  cloth_expires_at: "2024-01-10T00:00:00.000Z",
};

describe("getProfile", () => {
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user id is missing", async () => {
    const { supabase } = createProfilesSupabaseMock({
      data: null,
      error: null,
      status: 200,
    });

    await expect(getProfile(supabase, "", logger)).rejects.toBeInstanceOf(ProfileServiceError);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("throws ProfileForbiddenError on 403 responses and logs warning", async () => {
    const { supabase } = createProfilesSupabaseMock({
      data: null,
      error: { message: "RLS denied", code: "PGRST301" },
      status: 403,
    });

    await expect(getProfile(supabase, "user-123", logger)).rejects.toBeInstanceOf(ProfileForbiddenError);
    expect(logger.warn).toHaveBeenCalledWith(
      "Access to profile denied by row level security.",
      expect.objectContaining({
        userId: "user-123",
        status: 403,
        code: "PGRST301",
      }),
    );
  });

  it("wraps unexpected Supabase errors in ProfileServiceError", async () => {
    const { supabase } = createProfilesSupabaseMock({
      data: null,
      error: { message: "Database unavailable", code: "500" },
      status: 500,
    });

    await expect(getProfile(supabase, "user-500", logger)).rejects.toBeInstanceOf(ProfileServiceError);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to fetch profile from Supabase.",
      expect.objectContaining({
        userId: "user-500",
        status: 500,
        code: "500",
        error: "Database unavailable",
      }),
    );
  });

  it("returns missing status when profile not found", async () => {
    const { supabase } = createProfilesSupabaseMock({
      data: null,
      error: null,
      status: 200,
    });

    const result = await getProfile(supabase, "user-missing", logger);
    expect(result).toEqual({ status: "missing" });
  });

  it("maps profile row to DTO and warns when quota usage exceeds total", async () => {
    const row: Tables<"profiles"> = {
      ...baseRow,
      free_generation_quota: 2,
      free_generation_used: 5,
      persona_path: null,
      cloth_path: null,
      cloth_expires_at: null,
    };

    const { supabase } = createProfilesSupabaseMock({
      data: row,
      error: null,
      status: 200,
    });

    const result = await getProfile(supabase, row.user_id, logger);

    expect(result.status).toBe("found");
    expect(result.status === "found" ? result.profile.persona : null).toBeNull();
    expect(result.status === "found" ? result.profile.consent : null).toEqual({
      currentVersion: "v1",
      acceptedVersion: row.consent_version,
      acceptedAt: row.consent_accepted_at,
      isCompliant: true,
    });
    expect(result.status === "found" ? result.profile.quota.free : null).toEqual({
      total: 2,
      used: 5,
      remaining: 0,
      renewsAt: row.quota_renewal_at,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Detected quota usage greater than total allocation.",
      expect.objectContaining({
        userId: row.user_id,
        total: 2,
        used: 5,
      }),
    );
  });

  it("returns persona defaults when path exists", async () => {
    const { supabase } = createProfilesSupabaseMock({
      data: baseRow,
      error: null,
      status: 200,
    });

    const result = await getProfile(supabase, baseRow.user_id, logger);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.profile.persona).toEqual({
        path: baseRow.persona_path,
        updatedAt: baseRow.updated_at,
        width: 0,
        height: 0,
        contentType: "image/*",
      });
      expect(result.profile.clothCache).toEqual({
        path: baseRow.cloth_path,
        expiresAt: baseRow.cloth_expires_at,
      });
    }
  });
});
