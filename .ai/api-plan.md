# REST API Plan

## 1. Resources
- **Profile** (`profiles`): Holds per-user persona metadata, garment cache pointers, consent state, and quota counters tied to `auth.users.user_id`.
- **Persona Asset** (`profiles.persona_path`): Persistent base image reference for VTON; stored in Supabase Storage and versioned through profile timestamps.
- **Consent Record** (`profiles.consent_version`, `profiles.consent_accepted_at`): Tracks the policy version agreed to before persona upload and each generation.
- **Quota Ledger** (`profiles.free_generation_quota`, `profiles.free_generation_used`, `profiles.quota_renewal_at`): Enforces the free-generation limit and renewal schedule.
- **VTON Generation** (`vton_generations`): Represents each Vertex AI job, including persona/garment snapshots, status lifecycle, storage paths, and timing metadata.
- **Generation Rating** (`vton_generations.user_rating`, `vton_generations.rated_at`): Optional user feedback captured per generation.
- **Vertex Job Status** (`generation_status` enum): Allowed states (`queued`, `processing`, `succeeded`, `failed`, `expired`) applied to `vton_generations.status`.

## 2. Endpoints

### Profile
- **GET /api/profile**
  - Description: Fetch the authenticated user’s profile, including persona presence, consent state, and quota summary.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "userId": "uuid",
      "persona": {
        "path": "storage://personas/user-123.png",
        "updatedAt": "2024-03-12T10:15:00Z",
        "width": 1024,
        "height": 1024,
        "contentType": "image/png"
      },
      "consent": {
        "currentVersion": "v1",
        "acceptedVersion": "v1",
        "acceptedAt": "2024-03-01T09:00:00Z",
        "isCompliant": true
      },
      "quota": {
        "free": {
          "total": 3,
          "used": 1,
          "remaining": 2,
          "renewsAt": "2024-04-01T00:00:00Z"
        }
      },
      "clothCache": {
        "path": null,
        "expiresAt": null
      }
    }
    ```
  - Success: `200 OK` – profile returned; `204 No Content` if profile row not yet initialized.
  - Errors:
    - `401 Unauthorized` – missing Supabase session.
    - `403 Forbidden` – RLS denies access (should not occur for owner).
    - `500 Internal Server Error` – unexpected database failure.

- **PUT /api/profile/persona**
  - Description: Upload or replace the base persona image for the authenticated user after consent validation.
  - Query Parameters: None
  - Request Body: `multipart/form-data`
    - `persona` (file, required, JPEG/PNG, ≥1024x1024)
    - `contentType` (string, optional; server will derive if omitted)
  - Response Body:
    ```json
    {
      "persona": {
        "path": "storage://personas/user-123.png",
        "width": 1024,
        "height": 1024,
        "contentType": "image/png",
        "updatedAt": "2024-03-12T10:15:00Z",
        "checksum": "sha256:..."
      },
      "consent": {
        "requiredVersion": "v1",
        "acceptedVersion": "v1",
        "acceptedAt": "2024-03-01T09:00:00Z"
      }
    }
    ```
  - Success: `200 OK` – persona saved; `201 Created` – persona saved for first time.
  - Errors:
    - `400 Bad Request` – invalid media type, resolution, or missing file.
    - `401 Unauthorized` – missing session.
    - `403 Forbidden` – consent not accepted for required version.
    - `409 Conflict` – concurrent update detected (e.g., outdated ETag).
    - `413 Payload Too Large` – file exceeds allowed size.
    - `500 Internal Server Error` – storage or database failure.

- **DELETE /api/profile/persona**
  - Description: Remove the stored persona image and clear associated storage objects.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "persona": null,
      "removedAt": "2024-03-12T10:20:00Z"
    }
    ```
  - Success: `200 OK` – persona removed.
  - Errors:
    - `401 Unauthorized` – missing session.
    - `404 Not Found` – persona not set.
    - `500 Internal Server Error` – storage deletion failure.

- **GET /api/profile/consent**
  - Description: Retrieve the latest consent version required by policy and the user’s acceptance status.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "requiredVersion": "v1",
      "acceptedVersion": "v1",
      "acceptedAt": "2024-03-01T09:00:00Z",
      "isCompliant": true
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `500 Internal Server Error`

- **POST /api/profile/consent**
  - Description: Record explicit user consent for the current policy version; must precede persona upload and each VTON generation.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "version": "v1",
      "accepted": true
    }
    ```
  - Response Body:
    ```json
    {
      "acceptedVersion": "v1",
      "acceptedAt": "2024-03-12T10:10:00Z",
      "expiresAt": null
    }
    ```
  - Success: `200 OK` – consent updated; `201 Created` – first-time consent.
  - Errors:
    - `400 Bad Request` – unsupported version or `accepted` false.
    - `401 Unauthorized`
    - `409 Conflict` – newer consent version already on record.
    - `500 Internal Server Error`

- **GET /api/profile/quota**
  - Description: Return remaining free-generation allowance for the authenticated user.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "free": {
        "total": 3,
        "used": 2,
        "remaining": 1,
        "renewsAt": "2024-04-01T00:00:00Z"
      },
      "hardLimitReached": false
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `500 Internal Server Error`

- **POST /api/profile/quota/reset** *(internal, cron)*
  - Description: Reset free-generation counts for accounts whose `quota_renewal_at` has passed.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "batchSize": 1000
    }
    ```
  - Response Body:
    ```json
    {
      "resetCount": 245,
      "nextRunAfter": "2024-04-02T00:00:00Z"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized` / `403 Forbidden` – missing service-role token.
    - `500 Internal Server Error`

### VTON Generations
- **POST /api/vton/generations**
  - Description: Enqueue a new Vertex AI VTON job using the stored persona and uploaded garment; decrements the free quota atomically.
  - Query Parameters: None
  - Request Body: `multipart/form-data`
    - `garment` (file, required, JPEG/PNG, ≥1024x1024)
    - `retainForHours` (integer, optional, 24–72 default 48)
    - `consentVersion` (string, required) – must match current policy
  - Response Body:
    ```json
    {
      "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
      "status": "queued",
      "vertexJobId": "vton-job-123",
      "etaSeconds": 90,
      "quota": {
        "remainingFree": 0
      },
      "createdAt": "2024-03-12T10:30:00Z",
      "personaSnapshotPath": "storage://personas/user-123.png",
      "clothSnapshotPath": "storage://garments/tmp-456.png",
      "expiresAt": "2024-03-14T10:30:00Z"
    }
    ```
  - Success: `202 Accepted` – job queued.
  - Errors:
    - `400 Bad Request` – invalid garment or retain window.
    - `401 Unauthorized`
    - `403 Forbidden` – consent missing or persona absent.
    - `404 Not Found` – persona not configured.
    - `409 Conflict` – active job already running (optional guard).
    - `422 Unprocessable Entity` – garment fails AI pre-check.
    - `429 Too Many Requests` – quota exhausted.
    - `500 Internal Server Error` – Vertex or storage failure.

- **GET /api/vton/generations**
  - Description: List generation history for the authenticated user with pagination and filters.
  - Query Parameters:
    - `status` (enum, optional, multiple) – filter by job state
    - `from` (ISO timestamp, optional) – created_at lower bound
    - `to` (ISO timestamp, optional) – created_at upper bound
    - `limit` (int, optional, default 20, max 100)
    - `cursor` (string, optional) – pagination cursor from previous response
  - Request Body: None
  - Response Body:
    ```json
    {
      "items": [
        {
          "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
          "status": "succeeded",
          "createdAt": "2024-03-12T10:30:00Z",
          "completedAt": "2024-03-12T10:31:42Z",
          "thumbnailUrl": "https://signed.supabase.co/.../thumb.png",
          "rating": 4,
          "errorReason": null,
          "expiresAt": "2024-03-14T10:30:00Z"
        }
      ],
      "nextCursor": "eyJpZCI6IjJhIn0="
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `400 Bad Request` – invalid filter combination.
    - `500 Internal Server Error`

- **GET /api/vton/generations/{id}**
  - Description: Retrieve detailed status for a specific generation.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
      "status": "processing",
      "personaSnapshotPath": "storage://personas/user-123.png",
      "clothSnapshotPath": "storage://garments/tmp-456.png",
      "resultPath": null,
      "vertexJobId": "vton-job-123",
      "errorReason": null,
      "createdAt": "2024-03-12T10:30:00Z",
      "startedAt": "2024-03-12T10:30:10Z",
      "completedAt": null,
      "ratedAt": null,
      "expiresAt": "2024-03-14T10:30:00Z"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `403 Forbidden` – requesting another user’s job (blocked by RLS).
    - `404 Not Found` – unknown ID.
    - `410 Gone` – job deleted/expired.
    - `500 Internal Server Error`

- **GET /api/vton/generations/{id}/download**
  - Description: Issue a short-lived signed URL for the generated asset when status is `succeeded` and asset still retained.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "signedUrl": "https://signed.supabase.co/....png",
      "expiresAt": "2024-03-12T11:00:00Z",
      "contentType": "image/png"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `403 Forbidden` – job not owned or consent rescinded.
    - `404 Not Found` – result missing.
    - `410 Gone` – result expired per TTL.
    - `423 Locked` – job still processing.
    - `500 Internal Server Error`

- **POST /api/vton/generations/{id}/rating**
  - Description: Set or update the user’s rating (1–5) for a completed generation.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "rating": 4
    }
    ```
  - Response Body:
    ```json
    {
      "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
      "rating": 4,
      "ratedAt": "2024-03-12T10:40:00Z"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `400 Bad Request` – rating outside 1–5.
    - `401 Unauthorized`
    - `403 Forbidden`
    - `404 Not Found` – generation not found or not succeeded.
    - `409 Conflict` – rating already locked after analytics export (optional safeguard).
    - `500 Internal Server Error`

- **DELETE /api/vton/generations/{id}**
  - Description: Soft-delete a generation record and purge associated storage assets ahead of scheduled cleanup.
  - Query Parameters: None
  - Request Body: None
  - Response Body:
    ```json
    {
      "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
      "deletedAt": "2024-03-12T11:00:00Z"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized`
    - `403 Forbidden`
    - `404 Not Found`
    - `500 Internal Server Error`

- **PATCH /api/vton/generations/{id}** *(internal worker)*
  - Description: Update generation status, result path, and timestamps when Vertex job progresses; requires service-role authentication.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "status": "succeeded",
      "resultPath": "storage://results/2c7d0d46.png",
      "completedAt": "2024-03-12T10:31:42Z",
      "errorReason": null,
      "expiresAt": "2024-03-14T10:30:00Z"
    }
    ```
  - Response Body:
    ```json
    {
      "id": "2c7d0d46-8eb6-4e38-9f5a-5c54c9a5a6f1",
      "status": "succeeded"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `400 Bad Request` – status regression or missing timestamps.
    - `401 Unauthorized` / `403 Forbidden` – missing service token.
    - `409 Conflict` – optimistic lock failure.
    - `500 Internal Server Error`

### Webhooks & System Maintenance
- **POST /api/vton/webhooks/vertex**
  - Description: Receive asynchronous callbacks from Vertex AI, validate signature, and forward updates to the worker update endpoint.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "jobId": "vton-job-123",
      "state": "SUCCEEDED",
      "outputUri": "gs://vertex-results/job-123/output.png",
      "error": null
    }
    ```
  - Response Body:
    ```json
    {
      "acknowledged": true
    }
    ```
  - Success: `202 Accepted`
  - Errors:
    - `400 Bad Request` – invalid payload.
    - `401 Unauthorized` – failed signature verification.
    - `404 Not Found` – jobId not mapped.
    - `409 Conflict` – duplicate callback already processed.
    - `500 Internal Server Error`

- **POST /api/internal/storage/cleanup**
  - Description: Trigger removal of expired garment and result assets along with DB updates to nullify paths; used by scheduled job or manual run.
  - Query Parameters: None
  - Request Body:
    ```json
    {
      "maxDeletes": 500,
      "dryRun": false
    }
    ```
  - Response Body:
    ```json
    {
      "garmentsPurged": 220,
      "resultsPurged": 205,
      "profilesUpdated": 18,
      "executedAt": "2024-03-12T23:00:00Z"
    }
    ```
  - Success: `200 OK`
  - Errors:
    - `401 Unauthorized` / `403 Forbidden`
    - `500 Internal Server Error`

## 3. Authentication and Authorization
- Rely on Supabase Auth access tokens (`Authorization: Bearer <access_token>`) on every client-facing request; Supabase Edge Functions or Astro backend validates tokens and injects `auth.uid()` into database calls to satisfy RLS on `profiles` and `vton_generations`.
- All profile and generation endpoints execute with the user’s session context, ensuring RLS policies restrict access to `auth.uid() = user_id`.
- File uploads use Supabase Storage signed URLs scoped to the authenticated user; persona bucket remains private with access mediated by API.
- Service-to-service endpoints (`POST /api/profile/quota/reset`, `PATCH /api/vton/generations/{id}`, `POST /api/internal/storage/cleanup`) require Supabase service-role token delivered via `Authorization: Bearer <service_jwt>` and additional HMAC header to prevent misuse.
- Vertex webhook validates requests using Google-signed JWT or configurable secret header before processing updates; responses use idempotency via jobId tracking to prevent replay.
- Apply per-user rate limiting (e.g., 10 persona uploads/day, 5 generation requests/hour) at the API gateway to mitigate abuse and manage cost.
- Enforce HTTPS and signed URL expirations ≤5 minutes for downloads; return `401` on expired tokens.

## 4. Validation and Business Logic
- **Profile & Persona**
  - Reject persona uploads lacking accepted consent or files smaller than 1024×1024 or not JPEG/PNG; map validation errors to `400 Bad Request`.
  - After storing persona, set `profiles.updated_at` trigger and ensure old asset is deleted; return latest persona metadata.
  - `DELETE /persona` clears storage and sets `persona_path` to null without affecting quota fields.
- **Consent**
  - Require `version` payload to match server-side `CURRENT_CONSENT_VERSION`; otherwise return `400`.
  - Maintain audit by updating `consent_accepted_at`; only allow forward-compatible updates (no downgrades).
- **Quota**
  - Wrap generation creation in transaction: assert `free_generation_used < free_generation_quota`; increment `free_generation_used` and set `quota_renewal_at` if null.
  - Scheduled reset sets `free_generation_used` back to `0` and advances `quota_renewal_at`; respect DB checks enforcing non-negative values.
- **VTON Generation**
  - Ensure persona exists before queuing; fail fast with `403` if missing.
  - Validate garment metadata (resolution, type) pre-upload; return `422` for model-level validation failures.
  - On job creation, persist `persona_path_snapshot`, `cloth_path_snapshot`, initialize `status='queued'`, and set `expires_at` based on requested retention (max 72 hours).
  - Worker updates must honor monotonic timestamps (`completed_at >= created_at`, etc.) and status progression (queued → processing → succeeded/failed/expired).
  - Vertex callback pipeline records `vertex_job_id`, handles failure states by populating `error_reason`, and triggers user notifications.
- **Download**
  - Only allow when `status='succeeded'` and `expires_at` > now; else respond with `423` (processing) or `410` (expired).
- **Ratings**
  - Accept integer ratings 1–5; set `rated_at=now()`; enforce DB constraint linking rating presence to timestamp.
  - Subsequent rating updates overwrite value but maintain audit via `rated_at`.
- **Cleanup**
  - Scheduled cleanup queries assets ordered by `expires_at` using indexes, removes storage objects, and nullifies `result_path`/`cloth_path`, satisfying check that `cloth_path` implies `cloth_expires_at`.
  - Persona assets are excluded from cleanup; TTL applies only to garments and results.
- **Error Handling**
  - Return structured error payloads `{ "code": "quota_exhausted", "message": "..." }` to distinguish between validation, authentication, quota, and system errors.
  - Log all interactions with Vertex API, including request IDs, for traceability and debugging.
