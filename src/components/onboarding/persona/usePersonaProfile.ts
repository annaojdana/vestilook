import { useCallback, useMemo, useState } from "react";

import type {
  ConsentReceipt,
  ConsentRequirement,
  FreeQuotaSnapshot,
  PersonaAssetMetadata,
  PersonaUploadResponseDto,
  PersonaViewModel,
  ProfileResponseDto,
} from "@/types.ts";

const FALLBACK_CONSENT_VERSION = "v1";

function mapConsent(requirement?: ProfileResponseDto["consent"] | null): ConsentRequirement {
  if (!requirement) {
    return {
      requiredVersion: FALLBACK_CONSENT_VERSION,
      acceptedVersion: null,
      acceptedAt: null,
      isCompliant: false,
    };
  }

  return {
    requiredVersion: requirement.currentVersion ?? FALLBACK_CONSENT_VERSION,
    acceptedVersion: requirement.acceptedVersion ?? null,
    acceptedAt: requirement.acceptedAt ?? null,
    isCompliant: Boolean(requirement.isCompliant),
  };
}

function mapQuota(snapshot?: ProfileResponseDto["quota"] | null): FreeQuotaSnapshot {
  if (!snapshot?.free) {
    return {
      total: 0,
      used: 0,
      remaining: 0,
      renewsAt: null,
    };
  }

  return snapshot.free;
}

function mapViewModel(
  persona: PersonaAssetMetadata | null,
  consent: ConsentRequirement,
  quota: FreeQuotaSnapshot
): PersonaViewModel {
  return {
    persona,
    consent,
    quota,
    canContinue: Boolean(persona),
  };
}

function isConsentEqual(a: ConsentRequirement, b: ConsentRequirement): boolean {
  return (
    a.requiredVersion === b.requiredVersion &&
    a.acceptedVersion === b.acceptedVersion &&
    a.acceptedAt === b.acceptedAt &&
    a.isCompliant === b.isCompliant
  );
}

export interface UsePersonaProfileResult {
  viewModel: PersonaViewModel;
  persona: PersonaAssetMetadata | null;
  consent: ConsentRequirement;
  quota: FreeQuotaSnapshot;
  applyPersonaUpdate: (persona: PersonaAssetMetadata | null) => void;
  applyConsentRequirement: (requirement: ConsentRequirement) => void;
  applyConsentReceipt: (receipt: ConsentReceipt) => void;
  applyUploadResponse: (payload: PersonaUploadResponseDto) => void;
  applyProfileSnapshot: (profile: ProfileResponseDto | null) => void;
  resetPersona: () => void;
}

export function usePersonaProfile(initialProfile: ProfileResponseDto | null): UsePersonaProfileResult {
  const [persona, setPersona] = useState<PersonaAssetMetadata | null>(initialProfile?.persona ?? null);
  const [consent, setConsent] = useState<ConsentRequirement>(mapConsent(initialProfile?.consent));
  const [quota, setQuota] = useState<FreeQuotaSnapshot>(mapQuota(initialProfile?.quota));

  const viewModel = useMemo(() => mapViewModel(persona, consent, quota), [persona, consent, quota]);

  const applyPersonaUpdate = useCallback((nextPersona: PersonaAssetMetadata | null) => {
    setPersona(nextPersona);
  }, []);

  const applyConsentRequirement = useCallback((nextRequirement: ConsentRequirement) => {
    setConsent((current) => (isConsentEqual(current, nextRequirement) ? current : nextRequirement));
  }, []);

  const applyConsentReceipt = useCallback(
    (receipt: ConsentReceipt) => {
      setConsent((current) => {
        const requiredVersion = current.requiredVersion ?? FALLBACK_CONSENT_VERSION;
        const acceptedVersion = receipt.acceptedVersion ?? current.acceptedVersion ?? null;
        const acceptedAt = receipt.acceptedAt ?? current.acceptedAt ?? null;

        return {
          requiredVersion,
          acceptedVersion,
          acceptedAt,
          isCompliant: Boolean(acceptedVersion && acceptedVersion === requiredVersion),
        };
      });
    },
    []
  );

  const applyUploadResponse = useCallback((payload: PersonaUploadResponseDto) => {
    setPersona(payload.persona);
    setConsent((current) => {
      const requiredVersion = payload.consent.requiredVersion ?? current.requiredVersion ?? FALLBACK_CONSENT_VERSION;
      const acceptedVersion = payload.consent.acceptedVersion ?? current.acceptedVersion ?? null;

      return {
        requiredVersion,
        acceptedVersion,
        acceptedAt: payload.consent.acceptedAt ?? current.acceptedAt ?? null,
        isCompliant: Boolean(acceptedVersion && acceptedVersion === requiredVersion),
      };
    });
  }, []);

  const applyProfileSnapshot = useCallback((snapshot: ProfileResponseDto | null) => {
    if (!snapshot) {
      setPersona(null);
      setConsent(mapConsent(null));
      setQuota(mapQuota(null));
      return;
    }

    setPersona(snapshot.persona ?? null);
    setConsent(mapConsent(snapshot.consent));
    setQuota(mapQuota(snapshot.quota));
  }, []);

  const resetPersona = useCallback(() => {
    setPersona(null);
  }, []);

  return {
    viewModel,
    persona,
    consent,
    quota,
    applyPersonaUpdate,
    applyConsentRequirement,
    applyConsentReceipt,
    applyUploadResponse,
    applyProfileSnapshot,
    resetPersona,
  };
}
