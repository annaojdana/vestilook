import type { Tables, Enums } from "./db/database.types";

type ProfileRow = Tables<"profiles">;
type VtonGenerationRow = Tables<"vton_generations">;
type GenerationStatus = Enums<"generation_status">;

type IsoTimestamp = ProfileRow["created_at"];
type Uuid = ProfileRow["user_id"];
type GenerationRatingValue = NonNullable<VtonGenerationRow["user_rating"]>;

export interface PersonaAssetMetadata {
  path: NonNullable<ProfileRow["persona_path"]>;
  updatedAt: ProfileRow["updated_at"];
  width: number;
  height: number;
  contentType: string;
  /**
   * Includes checksum when the asset was produced during the current response.
   */
  checksum?: string;
}

export interface PersonaAssetWithChecksum extends PersonaAssetMetadata {
  checksum: string;
}

export interface ConsentStateSnapshot {
  currentVersion: string;
  acceptedVersion: ProfileRow["consent_version"];
  acceptedAt: ProfileRow["consent_accepted_at"];
  isCompliant: boolean;
}

export interface ConsentReceipt {
  acceptedVersion: ProfileRow["consent_version"];
  acceptedAt: ProfileRow["consent_accepted_at"];
  expiresAt: ProfileRow["quota_renewal_at"];
}

export interface PersonaUploadCommand {
  persona: Blob;
  contentType?: string;
}

export interface PersonaUploadResponseDto {
  persona: PersonaAssetWithChecksum;
  consent: {
    requiredVersion: string;
    acceptedVersion: ProfileRow["consent_version"];
    acceptedAt: ProfileRow["consent_accepted_at"];
  };
}

export interface PersonaDeletionResponseDto {
  persona: null;
  removedAt: IsoTimestamp;
}

export interface ClothCacheDescriptor {
  path: ProfileRow["cloth_path"];
  expiresAt: ProfileRow["cloth_expires_at"];
}

export interface FreeQuotaSnapshot {
  total: ProfileRow["free_generation_quota"];
  used: ProfileRow["free_generation_used"];
  remaining: number;
  renewsAt: ProfileRow["quota_renewal_at"];
}

export interface ProfileResponseDto {
  userId: Uuid;
  persona: PersonaAssetMetadata | null;
  consent: ConsentStateSnapshot;
  quota: {
    free: FreeQuotaSnapshot;
  };
  clothCache: ClothCacheDescriptor;
}

export interface ConsentStatusResponseDto {
  requiredVersion: string;
  acceptedVersion: ProfileRow["consent_version"];
  acceptedAt: ProfileRow["consent_accepted_at"];
  isCompliant: boolean;
}

export interface ConsentUpsertCommand {
  version: ProfileRow["consent_version"];
  accepted: true;
}

export type ConsentUpsertResponseDto = ConsentReceipt;

export interface QuotaSummaryResponseDto {
  free: FreeQuotaSnapshot;
  hardLimitReached: boolean;
}

export interface QuotaResetCommand {
  batchSize: number;
}

export interface QuotaResetResultDto {
  resetCount: number;
  nextRunAfter: ProfileRow["quota_renewal_at"];
}

export interface GenerationCreateCommand {
  garment: Blob;
  garmentFilename: string;
  consentVersion: ProfileRow["consent_version"];
  retainForHours?: number;
}

export interface ImageValidationConstraints {
  minWidth: number;
  minHeight: number;
  maxBytes: number;
  allowedMimeTypes: string[];
}

export type GarmentValidationErrorCode =
  | "missing_file"
  | "unsupported_mime"
  | "invalid_dimensions"
  | "below_min_resolution"
  | "exceeds_max_size";

export interface GarmentAssetMetadata {
  width: number;
  height: number;
  size: number;
  contentType: string;
  checksum: string;
}

export interface GarmentValidationSuccess {
  ok: true;
  metadata: GarmentAssetMetadata;
}

export interface GarmentValidationFailure {
  ok: false;
  code: GarmentValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type GarmentValidationResult = GarmentValidationSuccess | GarmentValidationFailure;

export interface StoredGarmentSnapshot extends GarmentAssetMetadata {
  path: string;
  storedAt: IsoTimestamp;
  expiresAt: IsoTimestamp | null;
}

export interface VtonEnvironmentConfig {
  vertexProjectId: string;
  vertexLocation: string;
  vertexModel: string;
  garmentBucket: string;
  personaBucket: string;
  generationBucket: string;
  defaultEtaSeconds: number;
  maxGarmentBytes: number;
  minGarmentWidth: number;
  minGarmentHeight: number;
  allowedGarmentMimeTypes: string[];
}

export interface GenerationQueuedResponseDto {
  id: VtonGenerationRow["id"];
  status: GenerationStatus;
  vertexJobId: VtonGenerationRow["vertex_job_id"];
  etaSeconds: number;
  quota: {
    remainingFree: number;
  };
  createdAt: VtonGenerationRow["created_at"];
  personaSnapshotPath: VtonGenerationRow["persona_path_snapshot"];
  clothSnapshotPath: VtonGenerationRow["cloth_path_snapshot"];
  expiresAt: VtonGenerationRow["expires_at"];
}

export interface GenerationSummaryDto {
  id: VtonGenerationRow["id"];
  status: GenerationStatus;
  createdAt: VtonGenerationRow["created_at"];
  completedAt: VtonGenerationRow["completed_at"];
  thumbnailUrl: string;
  rating: VtonGenerationRow["user_rating"];
  errorReason: VtonGenerationRow["error_reason"];
  expiresAt: VtonGenerationRow["expires_at"];
}

export interface GenerationListResponseDto {
  items: GenerationSummaryDto[];
  nextCursor: string | null;
}

// ---------------------------
// Onboarding persona view
// ---------------------------

export interface ConsentRequirement {
  requiredVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  isCompliant: boolean;
}

export interface PersonaViewModel {
  persona: PersonaAssetMetadata | null;
  consent: ConsentRequirement;
  quota: FreeQuotaSnapshot;
  canContinue: boolean;
}

export interface UploadConstraints {
  allowedMimeTypes: string[];
  minWidth: number;
  minHeight: number;
  maxBytes: number;
  retentionHours: number;
}

export const PERSONA_UPLOAD_CONSTRAINTS: UploadConstraints = {
  allowedMimeTypes: ["image/jpeg", "image/png"],
  minWidth: 1024,
  minHeight: 1024,
  maxBytes: 15 * 1024 * 1024,
  retentionHours: 72,
};

export type PersonaUploaderStatus = "idle" | "ready" | "validating" | "uploading" | "success" | "error";

export type PersonaValidationErrorCode =
  | "missing_file"
  | "unsupported_mime"
  | "invalid_magic_number"
  | "invalid_dimensions"
  | "below_min_resolution"
  | "exceeds_max_size"
  | "encode_failure"
  | "checksum_failure"
  | "consent_required"
  | "network_error"
  | "server_error";

export interface PersonaValidationError {
  code: PersonaValidationErrorCode;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  severity?: "error" | "warning";
}

export type PersonaPreviewStatus = "empty" | "ready" | "uploading" | "error";

export interface PersonaPreviewModel {
  status: PersonaPreviewStatus;
  src: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  contentType: string | null;
  sizeBytes?: number | null;
  updatedAt?: string | null;
  checksum?: string;
  errorMessage?: string;
}

export type UploadStage = "idle" | "preparing" | "uploading" | "finalizing";

export interface UploadProgress {
  stage: UploadStage;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface PersonaUploadState {
  status: PersonaUploaderStatus;
  selectedFile: File | null;
  sanitizedBlob: Blob | null;
  preview: PersonaPreviewModel;
  validationErrors: PersonaValidationError[];
  progress: UploadProgress | null;
}

export interface DropzoneValidationResult {
  accepted: boolean;
  errors: PersonaValidationError[];
}

export interface SanitizedPersonaUploadCommand extends PersonaUploadCommand {
  checksum: string;
  width: number;
  height: number;
  size: number;
}

export type ToastVariant = "default" | "info" | "success" | "warning" | "error" | "progress";

export interface ToastActionPayload {
  label: string;
  onSelect: () => void;
}

export interface ToastPayload {
  id?: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number | null;
  action?: ToastActionPayload;
  dismissible?: boolean;
}

export interface GenerationDetailResponseDto {
  id: VtonGenerationRow["id"];
  status: GenerationStatus;
  personaSnapshotPath: VtonGenerationRow["persona_path_snapshot"];
  clothSnapshotPath: VtonGenerationRow["cloth_path_snapshot"];
  resultPath: VtonGenerationRow["result_path"];
  vertexJobId: VtonGenerationRow["vertex_job_id"];
  errorReason: VtonGenerationRow["error_reason"];
  createdAt: VtonGenerationRow["created_at"];
  startedAt: VtonGenerationRow["started_at"];
  completedAt: VtonGenerationRow["completed_at"];
  ratedAt: VtonGenerationRow["rated_at"];
  expiresAt: VtonGenerationRow["expires_at"];
}

export interface GenerationDownloadResponseDto {
  signedUrl: string;
  expiresAt: VtonGenerationRow["expires_at"];
  contentType: string;
}

export interface GenerationRatingCommand {
  rating: GenerationRatingValue;
}

export interface GenerationRatingResponseDto {
  id: VtonGenerationRow["id"];
  rating: GenerationRatingValue;
  ratedAt: VtonGenerationRow["rated_at"];
}

export interface GenerationDeletionResponseDto {
  id: VtonGenerationRow["id"];
  deletedAt: IsoTimestamp;
}

export interface GenerationUpdateCommand {
  status: GenerationStatus;
  resultPath?: VtonGenerationRow["result_path"];
  completedAt?: VtonGenerationRow["completed_at"];
  errorReason?: VtonGenerationRow["error_reason"];
  expiresAt?: VtonGenerationRow["expires_at"];
}

export interface GenerationUpdateResponseDto {
  id: VtonGenerationRow["id"];
  status: GenerationStatus;
}

export interface VertexWebhookCommand {
  jobId: NonNullable<VtonGenerationRow["vertex_job_id"]>;
  state: string;
  outputUri: string | null;
  error: string | null;
}

export interface VertexWebhookResponseDto {
  acknowledged: boolean;
}

export interface StorageCleanupCommand {
  maxDeletes: number;
  dryRun: boolean;
}

export interface StorageCleanupResultDto {
  garmentsPurged: number;
  resultsPurged: number;
  profilesUpdated: number;
  executedAt: IsoTimestamp;
}
