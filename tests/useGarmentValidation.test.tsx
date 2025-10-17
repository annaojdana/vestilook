import { act, cleanup, render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { createRef, forwardRef, useImperativeHandle } from "react";

import { useGarmentValidation, type UseGarmentValidationResult } from "@/components/generations/hooks/useGarmentValidation.ts";
import type { ImageValidationConstraints } from "@/types.ts";

const defaultConstraints: ImageValidationConstraints = {
  minWidth: 1024,
  minHeight: 1024,
  maxBytes: 7_340_032,
  allowedMimeTypes: ["image/jpeg", "image/png"],
};

let mockDimensions = { width: 1600, height: 1600, shouldError: false };

beforeAll(() => {
  const OriginalImage = globalThis.Image;

  class MockImage {
    public onload: ((event: Event) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public decoding = "async";
    public naturalWidth = 0;
    public naturalHeight = 0;

    // eslint-disable-next-line class-methods-use-this
    set src(_: string) {
      if (mockDimensions.shouldError) {
        queueMicrotask(() => this.onerror?.(new Event("error")));
        return;
      }

      this.naturalWidth = mockDimensions.width;
      this.naturalHeight = mockDimensions.height;
      queueMicrotask(() => this.onload?.(new Event("load")));
    }
  }

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: MockImage,
  });

  Object.defineProperty(globalThis, "__OriginalImage__", {
    configurable: true,
    writable: false,
    value: OriginalImage,
  });
});

afterAll(() => {
  const OriginalImage = (globalThis as { __OriginalImage__?: typeof Image }).__OriginalImage__;
  if (OriginalImage) {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: OriginalImage,
    });
  }
});

beforeEach(() => {
  mockDimensions = { width: 1600, height: 1600, shouldError: false };

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createFileList(file: File | null): FileList | null {
  if (!file) {
    return null;
  }

  const items = [file];

  return {
    0: file,
    length: items.length,
    item: (index: number) => items[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* items;
    },
  } as unknown as FileList;
}

const HookHarness = forwardRef<UseGarmentValidationResult, { constraints: ImageValidationConstraints }>(
  ({ constraints }, ref) => {
    const hook = useGarmentValidation(constraints);
    useImperativeHandle(ref, () => hook, [hook]);
    return null;
  }
);
HookHarness.displayName = "HookHarness";

describe("useGarmentValidation", () => {
  it("signals missing file when no input provided", async () => {
    const hookRef = createRef<UseGarmentValidationResult>();
    render(<HookHarness ref={hookRef} constraints={defaultConstraints} />);
    await waitFor(() => expect(hookRef.current).not.toBeNull());

    await act(async () => {
      const result = await hookRef.current!.validate(null);
      expect(result).toBeNull();
    });

    expect(hookRef.current?.error?.code).toBe("missing_file");
    expect(hookRef.current?.validating).toBe(false);
  });

  it("rejects unsupported mime types", async () => {
    const hookRef = createRef<UseGarmentValidationResult>();
    render(<HookHarness ref={hookRef} constraints={defaultConstraints} />);
    await waitFor(() => expect(hookRef.current).not.toBeNull());

    const file = new File(["example"], "notes.txt", { type: "text/plain" });
    const files = createFileList(file);

    await act(async () => {
      const result = await hookRef.current!.validate(files);
      expect(result).toBeNull();
    });

    expect(hookRef.current?.error?.code).toBe("unsupported_mime");
  });

  it("validates image dimensions and returns metadata", async () => {
    const hookRef = createRef<UseGarmentValidationResult>();
    render(<HookHarness ref={hookRef} constraints={defaultConstraints} />);
    await waitFor(() => expect(hookRef.current).not.toBeNull());

    mockDimensions = { width: 1536, height: 2048, shouldError: false };
    const payload = new Uint8Array(1_024);
    const file = new File([payload], "garment.png", { type: "image/png" });
    const files = createFileList(file);

    let result: Awaited<ReturnType<UseGarmentValidationResult["validate"]>> | null = null;
    await act(async () => {
      result = await hookRef.current!.validate(files);
    });

    expect(result).not.toBeNull();
    expect(result?.width).toBe(1536);
    expect(result?.height).toBe(2048);
    expect(result?.file).toBe(file);
    expect(hookRef.current?.error).toBeNull();
  });

  it("flags images below minimum resolution", async () => {
    const hookRef = createRef<UseGarmentValidationResult>();
    render(<HookHarness ref={hookRef} constraints={defaultConstraints} />);
    await waitFor(() => expect(hookRef.current).not.toBeNull());

    mockDimensions = { width: 800, height: 900, shouldError: false };
    const file = new File(["binary"], "garment.jpg", { type: "image/jpeg" });
    const files = createFileList(file);

    await act(async () => {
      const response = await hookRef.current!.validate(files);
      expect(response).toBeNull();
    });

    expect(hookRef.current?.error?.code).toBe("below_min_resolution");
  });
});
