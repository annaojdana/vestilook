/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsentRequirement, UploadConstraints } from "@/types.ts";
import { usePersonaUploader } from "../persona/usePersonaUploader.ts";

let accessTokenResolver: () => Promise<string> = () => Promise.resolve("token-default");
const accessTokenSpy = vi.fn(() => accessTokenResolver());

vi.mock("@/components/onboarding/persona/session.ts", () => ({
  requireAccessToken: () => accessTokenSpy(),
  isAccessTokenError: (error: unknown) => Boolean((error as { code?: string } | null)?.code === "unauthorized"),
}));

const setAccessTokenResolver = (resolver: () => Promise<string>) => {
  accessTokenResolver = resolver;
};

vi.mock("@/db/supabase.client.ts", () => ({
  supabaseClient: { auth: { getSession: vi.fn() } },
}));

interface XhrConfig {
  status: number;
  response: unknown;
}

const xhrConfig: XhrConfig = {
  status: 201,
  response: {},
};

const originalXMLHttpRequest = globalThis.XMLHttpRequest;
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

class MockXMLHttpRequest {
  static lastUpload?: MockXMLHttpRequest;

  upload = {
    onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null,
  };

  status = xhrConfig.status;
  statusText = xhrConfig.status >= 400 ? "Error" : "Created";
  response: any = JSON.stringify(xhrConfig.response);
  withCredentials = false;

  onload: (() => void) | null = null;
  onerror: ((error?: unknown) => void) | null = null;

  constructor() {
    MockXMLHttpRequest.lastUpload = this;
  }

  open() {}

  setRequestHeader() {}

  getAllResponseHeaders() {
    return "content-type: application/json";
  }

  send() {
    this.status = xhrConfig.status;
    this.response = JSON.stringify(xhrConfig.response);
    this.statusText = this.status >= 400 ? "Error" : "Created";

    if (this.upload.onprogress) {
      this.upload.onprogress({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent<EventTarget>);
    }

    this.onload?.();
  }

  abort() {
    this.onerror?.(new DOMException("Aborted", "AbortError"));
  }
}

const constraints: UploadConstraints = {
  allowedMimeTypes: ["image/png", "image/jpeg"],
  minWidth: 1024,
  minHeight: 1024,
  maxBytes: 15 * 1024 * 1024,
  retentionHours: 72,
};

const consentReady: ConsentRequirement = {
  requiredVersion: "v1",
  acceptedVersion: "v1",
  acceptedAt: "2024-01-01T00:00:00.000Z",
  isCompliant: true,
};

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const prepareStateForUpload = (state: any, file: File, blob: Blob) => {
  state.status = "ready";
  state.selectedFile = file;
  state.sanitizedBlob = blob;
  state.preview = {
    ...state.preview,
    status: "ready",
    src: "blob:preview",
    width: 2048,
    height: 2048,
    checksum: "hash",
    contentType: "image/png",
  };
  state.validationErrors = [];
  state.progress = null;
};

describe("usePersonaUploader network interactions", () => {
  beforeEach(() => {
    setAccessTokenResolver(() => Promise.resolve("token-xyz"));
    accessTokenSpy.mockClear();
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("uploads persona successfully and triggers callbacks", async () => {
    xhrConfig.status = 201;
    xhrConfig.response = {
      persona: {
        path: "personas/user/test.png",
        updatedAt: "2024-01-02T10:00:00.000Z",
        width: 2048,
        height: 2048,
        contentType: "image/png",
        checksum: "hash",
      },
      consent: {
        requiredVersion: "v1",
        acceptedVersion: "v1",
        acceptedAt: "2024-01-01T00:00:00.000Z",
      },
    };

    const onProgress = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      usePersonaUploader({
        constraints,
        consent: consentReady,
        onProgress,
        onSuccess,
      })
    );

    const file = new File([pngBytes], "persona.png", { type: "image/png" });
    const blob = new Blob([pngBytes], { type: "image/png" });

    act(() => {
      prepareStateForUpload(result.current.state, file, blob);
    });

    await act(async () => {
      const payload = await result.current.upload();
      expect(payload?.persona.path).toBe("personas/user/test.png");
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        percentage: expect.any(Number),
      })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ persona: expect.any(Object) }));
  });

  it("surfaces consent required when server returns 403", async () => {
    xhrConfig.status = 403;
    xhrConfig.response = {
      error: "Consent required.",
    };

    const onConsentRequired = vi.fn();
    const { result } = renderHook(() =>
      usePersonaUploader({
        constraints,
        consent: consentReady,
        onConsentRequired,
      })
    );

    const file = new File([pngBytes], "persona.png", { type: "image/png" });
    const blob = new Blob([pngBytes], { type: "image/png" });

    act(() => {
      prepareStateForUpload(result.current.state, file, blob);
    });

    await act(async () => {
      const response = await result.current.upload();
      expect(response).toBeNull();
    });

    expect(onConsentRequired).toHaveBeenCalled();
    expect(result.current.state.validationErrors[0]?.code).toBe("consent_required");
  });
});
