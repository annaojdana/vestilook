import { act, renderHook } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useConsentRedirect } from "@/components/onboarding/useConsentRedirect.ts";
import type { ConsentViewModel } from "@/components/onboarding/consent-types.ts";

const compliantViewModel: ConsentViewModel = {
  requiredVersion: "v1",
  acceptedVersion: "v1",
  acceptedAt: "2024-04-01T10:00:00.000Z",
  isCompliant: true,
  policyContent: "",
  policyUrl: "#",
  metadata: {
    source: "internal",
    updatedAt: "2024-04-01T10:00:00.000Z",
  },
};

const nonCompliantViewModel: ConsentViewModel = {
  ...compliantViewModel,
  isCompliant: false,
  acceptedVersion: "v0",
};

describe("useConsentRedirect", () => {
  const originalLocation = window.location;
  const assignSpy = vi.fn();

  beforeAll(() => {
    const locationMock: Partial<Location> = {
      assign: assignSpy as Location["assign"],
      reload: originalLocation.reload.bind(originalLocation),
      replace: originalLocation.replace.bind(originalLocation),
      toString: originalLocation.toString.bind(originalLocation),
    };

    Object.defineProperty(locationMock, "href", {
      value: originalLocation.href,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: locationMock as Location,
    });
  });

  beforeEach(() => {
    assignSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does not trigger redirect when consent is not compliant", () => {
    const { result } = renderHook(() =>
      useConsentRedirect({ viewModel: nonCompliantViewModel, nextPath: "/next" }),
    );

    expect(assignSpy).not.toHaveBeenCalled();
    expect(result.current.isRedirecting).toBe(false);
  });

  it("triggers redirect automatically when consent is compliant", () => {
    const { result } = renderHook(() =>
      useConsentRedirect({ viewModel: compliantViewModel, nextPath: "/dashboard" }),
    );

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
    expect(result.current.isRedirecting).toBe(true);
  });

  it("can reset redirect state and trigger only once", () => {
    const { result } = renderHook(() =>
      useConsentRedirect({ viewModel: null, nextPath: "/consent" }),
    );

    act(() => {
      result.current.triggerRedirect();
      result.current.triggerRedirect();
    });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isRedirecting).toBe(true);

    act(() => {
      result.current.resetRedirect();
    });

    expect(result.current.isRedirecting).toBe(false);

    act(() => {
      result.current.triggerRedirect();
    });

    expect(assignSpy).toHaveBeenCalledTimes(2);
  });
});
