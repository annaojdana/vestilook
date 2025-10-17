import type {
  ConsentUpsertResponseDto,
  GenerationQueuedResponseDto,
  GarmentValidationErrorCode,
  ProfileResponseDto,
} from "@/types.ts";

export interface GarmentValidationError {
  code: GarmentValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface GarmentFileState {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  validationError?: GarmentValidationError;
}

export interface ConsentFormState {
  currentVersion: string;
  acceptedVersion: string | null;
  isCompliant: boolean;
  acceptedAt?: string | null;
  checkboxChecked: boolean;
}

export interface QuotaViewModel {
  remaining: number;
  total: number;
  renewsAt: string | null;
  hardLimitReached: boolean;
}

export interface RetentionOption {
  value: number;
  label: string;
  description?: string;
}

export interface GenerationErrorState {
  code: string;
  message: string;
  field?: "garment" | "consent" | "form";
  retryAfterSeconds?: number;
}

export interface GenerationFormState {
  garment: GarmentFileState | null;
  consent: ConsentFormState;
  retainForHours: number;
  quota: QuotaViewModel;
  status: "idle" | "validating" | "submitting" | "success" | "error";
  error: GenerationErrorState | null;
}

export interface GenerationFormActions {
  setGarment: (value: GarmentFileState | null) => void;
  updateConsent: (update: Partial<ConsentFormState>) => void;
  setRetention: (value: number) => void;
  setQuota: (value: QuotaViewModel) => void;
  setStatus: (value: GenerationFormState["status"]) => void;
  setError: (value: GenerationErrorState | null) => void;
  reset: () => void;
}

export interface GenerationSubmissionResult {
  id: string;
  quota: {
    remainingFree: number;
  };
  etaSeconds: number;
}

export interface SubmitGenerationParams {
  garment: GarmentFileState;
  consent: ConsentFormState;
  retainForHours: number;
}

export interface SubmitGenerationOutcome {
  generation: GenerationSubmissionResult;
  payload: GenerationQueuedResponseDto;
  consentReceipt: ConsentUpsertResponseDto | null;
  refreshedProfile: ProfileResponseDto | null;
}

export interface UseGenerationSubmissionOptions {
  profile: ProfileResponseDto;
}

export interface UseGenerationSubmissionResult {
  profile: ProfileResponseDto;
  submitting: boolean;
  updatingConsent: boolean;
  error: GenerationErrorState | null;
  submitGeneration: (params: SubmitGenerationParams) => Promise<SubmitGenerationOutcome | null>;
  updateConsentIfRequired: (consent: ConsentFormState) => Promise<ConsentUpsertResponseDto | null>;
  refreshProfile: () => Promise<ProfileResponseDto | null>;
  resetError: () => void;
}
