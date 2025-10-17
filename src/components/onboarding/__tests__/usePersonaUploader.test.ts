import { describe, expect, it, vi } from "vitest";

import type { UploadConstraints } from "@/types.ts";
import { __testOnly } from "../persona/usePersonaUploader.ts";

const constraints: UploadConstraints = {
  allowedMimeTypes: ["image/jpeg", "image/png"],
  minWidth: 1024,
  minHeight: 1024,
  maxBytes: 15 * 1024 * 1024,
  retentionHours: 72,
};

vi.mock("@/db/supabase.client.ts", () => ({
  supabaseClient: { auth: { getSession: vi.fn() } },
}));

describe("usePersonaUploader parseValidationErrors", () => {
  it("maps 413 to exceeds_max_size error", () => {
    const result = __testOnly.parseValidationErrors(413, { error: "File too large.", details: { maxBytes: 1024 } }, constraints);
    expect(result[0]).toMatchObject({
      code: "exceeds_max_size",
    });
    expect(result[0].message).toContain("Maksymalny rozmiar");
  });

  it("maps unsupported mime error", () => {
    const result = __testOnly.parseValidationErrors(
      400,
      { error: "Unsupported mime type.", details: { allowedMimeTypes: ["image/jpeg"] } },
      constraints
    );
    expect(result[0]).toMatchObject({
      code: "unsupported_mime",
    });
    expect(result[0].message).toContain("Dozwolone");
  });

  it("maps below resolution error", () => {
    const result = __testOnly.parseValidationErrors(
      400,
      { error: "Image resolution too small.", details: { minWidth: 1280, minHeight: 1280 } },
      constraints
    );
    expect(result[0]).toMatchObject({
      code: "below_min_resolution",
    });
    expect(result[0].message).toContain("1280×1280");
  });

  it("falls back to server error message", () => {
    const result = __testOnly.parseValidationErrors(400, { error: "Unknown error." }, constraints);
    expect(result[0].code).toEqual("server_error");
  });
});
