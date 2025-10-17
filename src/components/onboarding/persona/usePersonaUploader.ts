import { useCallback, useMemo, useRef, useState } from "react";

import type {
  ConsentRequirement,
  PersonaUploadResponseDto,
  PersonaUploadState,
  PersonaValidationError,
  SanitizedPersonaUploadCommand,
  UploadConstraints,
  UploadProgress,
} from "@/types.ts";
import { requireAccessToken } from "./session.ts";

export interface UsePersonaUploaderOptions {
  constraints: UploadConstraints;
  consent: ConsentRequirement;
  onProgress?: (progress: UploadProgress) => void;
  onUnauthorized?: () => void;
  onConsentRequired?: () => void;
  onSuccess?: (response: PersonaUploadResponseDto) => void;
  onServerError?: (status: number, errorBody?: unknown) => void;
}

export interface UsePersonaUploaderResult {
  state: PersonaUploadState;
  busy: boolean;
  selectFile: (file: File) => Promise<void>;
  handleFileList: (list: FileList | File[]) => Promise<void>;
  removeFile: () => void;
  upload: () => Promise<PersonaUploadResponseDto | null>;
  resetValidation: () => void;
}

interface PreparedFile {
  sanitizedBlob: Blob;
  checksum: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  previewUrl: string;
  warnings: PersonaValidationError[];
}

const PERSONA_UPLOAD_ENDPOINT = "/api/profile/persona";

const EMPTY_PREVIEW = {
  status: "empty" as const,
  src: null,
  alt: "Brak wybranej persony",
  width: null,
  height: null,
  contentType: null,
  sizeBytes: null,
  updatedAt: null,
  checksum: null,
  errorMessage: null,
};

function createEmptyState(): PersonaUploadState {
  return {
    status: "idle",
    selectedFile: null,
    sanitizedBlob: null,
    preview: { ...EMPTY_PREVIEW },
    validationErrors: [],
    progress: null,
  };
}

export function usePersonaUploader(options: UsePersonaUploaderOptions): UsePersonaUploaderResult {
  const { constraints, consent, onProgress, onUnauthorized, onConsentRequired, onSuccess, onServerError } = options;
  const [state, setState] = useState<PersonaUploadState>(() => createEmptyState());
  const previewUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const busy = state.status === "validating" || state.status === "uploading";

  const resetPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const resetValidation = useCallback(() => {
    setState((current) => ({
      ...current,
      validationErrors: [],
    }));
  }, []);

  const removeFile = useCallback(() => {
    abortControllerRef.current?.abort();
    resetPreviewUrl();
    setState(createEmptyState());
  }, [resetPreviewUrl]);

  const handlePreparedFile = useCallback((prepared: PreparedFile, originalFile: File) => {
    resetPreviewUrl();
    previewUrlRef.current = prepared.previewUrl;

    setState({
      status: "ready",
      selectedFile: originalFile,
      sanitizedBlob: prepared.sanitizedBlob,
      preview: {
        status: "ready",
        src: prepared.previewUrl,
        alt: "Podgląd wybranej persony",
        width: prepared.width,
        height: prepared.height,
        contentType: prepared.mimeType,
        sizeBytes: prepared.size,
        checksum: prepared.checksum,
        updatedAt: null,
        errorMessage: null,
      },
      validationErrors: prepared.warnings ?? [],
      progress: null,
    });
  }, [resetPreviewUrl]);

  const selectFile = useCallback(
    async (file: File | null | undefined) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      if (!file) {
        const nextState = createEmptyState();
        nextState.status = "error";
        nextState.validationErrors = [
          {
            code: "missing_file",
            message: "Nie wybrano pliku do przesłania.",
          },
        ];
        setState(nextState);
        return;
      }

      setState((current) => ({
        ...current,
        status: "validating",
        validationErrors: [],
        progress: null,
      }));

      try {
        const prepared = await validateAndPrepareFile(file, constraints);

        if (prepared.errors.length > 0) {
          resetPreviewUrl();
          const nextState = createEmptyState();
          nextState.status = "error";
          nextState.validationErrors = prepared.errors;
          setState(nextState);
          return;
        }

        handlePreparedFile(prepared.payload, file);
      } catch (error) {
        console.error("[usePersonaUploader] Unexpected validation failure.", error);
        resetPreviewUrl();
        const nextState = createEmptyState();
        nextState.status = "error";
        nextState.validationErrors = [
          {
            code: "server_error",
            message: "Nie udało się przetworzyć pliku. Spróbuj ponownie.",
          },
        ];
        setState(nextState);
      }
    },
    [constraints, handlePreparedFile, resetPreviewUrl]
  );

  const handleFileList = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.isArray(list) ? list : Array.from(list ?? []);
      if (files.length === 0) {
        await selectFile(null);
        return;
      }

      await selectFile(files[0]);
    },
    [selectFile]
  );

  const upload = useCallback(async () => {
    if (busy) {
      return null;
    }

    if (!consent.isCompliant) {
      const consentError: PersonaValidationError = {
        code: "consent_required",
        message: "Musisz zaakceptować aktualną zgodę, zanim prześlesz personę.",
      };
      setState((current) => ({
        ...current,
        status: "error",
        validationErrors: [consentError],
      }));
      onConsentRequired?.();
      return null;
    }

    const { sanitizedBlob, selectedFile, preview } = state;
    if (!sanitizedBlob || !selectedFile || preview.width === null || preview.height === null || !preview.checksum) {
      setState((current) => ({
        ...current,
        status: "error",
        validationErrors: [
          {
            code: "server_error",
            message: "Brakuje danych pliku. Wybierz plik ponownie.",
          },
        ],
      }));
      return null;
    }

    setState((current) => ({
      ...current,
      status: "uploading",
      progress: {
        stage: "preparing",
        loadedBytes: 0,
        totalBytes: sanitizedBlob.size,
        percentage: 0,
      },
      validationErrors: [],
    }));

    const command: SanitizedPersonaUploadCommand = {
      persona: sanitizedBlob,
      contentType: sanitizedBlob.type,
      checksum: preview.checksum,
      width: preview.width,
      height: preview.height,
      size: sanitizedBlob.size,
    };

    let accessToken: string;
    try {
      accessToken = await requireAccessToken();
    } catch (error) {
      console.warn("[usePersonaUploader] Missing access token.", error);
      setState((current) => ({
        ...current,
        status: "error",
        validationErrors: [
          {
            code: "server_error",
            message: "Sesja wygasła. Zaloguj się ponownie.",
          },
        ],
      }));
      onUnauthorized?.();
      return null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("persona", command.persona, selectedFile.name);
    if (command.contentType) {
      formData.append("contentType", command.contentType);
    }
    formData.append("checksum", command.checksum);
    formData.append("width", command.width.toString(10));
    formData.append("height", command.height.toString(10));

    try {
      const response = await sendMultipartRequest(
        formData,
        accessToken,
        controller.signal,
        command.size,
        (progressEvent) => {
          setState((current) => ({
            ...current,
            progress: progressEvent,
          }));
          onProgress?.(progressEvent);
        }
      );

      if (response.status === 401) {
        onUnauthorized?.();
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors: [
            {
              code: "unauthorized",
              message: "Sesja wygasła. Zaloguj się ponownie.",
            },
          ],
        }));
        return null;
      }

      if (response.status === 403) {
        onConsentRequired?.();
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors: [
            {
              code: "consent_required",
              message: "Zaktualizuj zgodę, aby kontynuować przesyłanie persony.",
            },
          ],
        }));
        return null;
      }

      if (response.status === 400 || response.status === 413) {
        const validationErrors = parseValidationErrors(
          response.status,
          await safeParseJson<Record<string, unknown>>(response),
          constraints
        );
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors,
        }));
        return null;
      }

      if (response.status === 409) {
        const body = await safeParseJson<Record<string, unknown>>(response);
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors: [
            {
              code: "server_error",
              message:
                typeof body?.error === "string"
                  ? body.error
                  : "Persona została zmodyfikowana równolegle. Odśwież stronę i spróbuj ponownie.",
              hint: body?.details && typeof body.details === "object" ? JSON.stringify(body.details) : undefined,
            },
          ],
        }));
        onServerError?.(response.status, body);
        return null;
      }

      if (!response.ok) {
        const body = await safeParseJson(response);
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors: [
            {
              code: "server_error",
              message: "Przesyłanie nie powiodło się z powodu błędu serwera.",
            },
          ],
        }));
        onServerError?.(response.status, body);
        return null;
      }

      const payload = (await safeParseJson<PersonaUploadResponseDto>(response)) ?? null;
      if (!payload) {
        setState((current) => ({
          ...current,
          status: "error",
          validationErrors: [
            {
              code: "server_error",
              message: "Serwer zwrócił pustą odpowiedź po przesłaniu persony.",
            },
          ],
        }));
        return null;
      }

      setState((current) => ({
        ...current,
        status: "success",
        validationErrors: [],
        progress: {
          stage: "finalizing",
          loadedBytes: command.size,
          totalBytes: command.size,
          percentage: 100,
        },
        preview: {
          ...current.preview,
          status: "ready",
          updatedAt: new Date().toISOString(),
        },
      }));

      onSuccess?.(payload);
      return payload;
    } catch (error) {
      if (controller.signal.aborted) {
        return null;
      }

      console.error("[usePersonaUploader] Upload failed.", error);
      setState((current) => ({
        ...current,
        status: "error",
        validationErrors: [
          {
            code: error instanceof TypeError ? "network_error" : "server_error",
            message:
              error instanceof TypeError
                ? "Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie."
                : "Przesyłanie nie powiodło się. Spróbuj ponownie.",
          },
        ],
      }));
      return null;
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    busy,
    consent.isCompliant,
    state,
    onConsentRequired,
    onProgress,
    onServerError,
    onSuccess,
    onUnauthorized,
  ]);

  return useMemo(
    () => ({
      state,
      busy,
      selectFile,
      handleFileList,
      removeFile,
      upload,
      resetValidation,
    }),
    [busy, handleFileList, removeFile, resetValidation, selectFile, state, upload]
  );
}

interface ValidationResult {
  errors: PersonaValidationError[];
  payload: PreparedFile;
}

async function validateAndPrepareFile(file: File, constraints: UploadConstraints): Promise<ValidationResult> {
  const errors: PersonaValidationError[] = [];
  const warnings: PersonaValidationError[] = [];

  if (!constraints.allowedMimeTypes.includes(file.type)) {
    errors.push({
      code: "unsupported_mime",
      message: `Format pliku (${file.type || "nieznany"}) jest nieobsługiwany. Prześlij JPEG lub PNG.`,
    });
  }

  if (file.size > constraints.maxBytes) {
    errors.push({
      code: "exceeds_max_size",
      message: `Plik jest zbyt duży. Maksymalny rozmiar to ${formatBytes(constraints.maxBytes)}.`,
    });
  }

  const magicNumberValid = await validateMagicNumber(file).catch(() => false);
  if (!magicNumberValid) {
    errors.push({
      code: "invalid_magic_number",
      message: "Plik nie wygląda na prawidłowy obraz JPEG lub PNG.",
    });
  }

  const { width, height } = await readImageDimensions(file).catch(() => ({ width: 0, height: 0 }));
  if (!width || !height) {
    errors.push({
      code: "invalid_dimensions",
      message: "Nie udało się odczytać wymiarów obrazu.",
    });
  } else {
    if (width < constraints.minWidth || height < constraints.minHeight) {
      errors.push({
        code: "below_min_resolution",
        message: `Obraz powinien mieć co najmniej ${constraints.minWidth}×${constraints.minHeight} pikseli.`,
        details: { width, height },
      });
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      payload: await buildEmptyPreparedFile(),
    };
  }

  const sanitized = await sanitizeImage(file, width, height);
  if (!sanitized.ok) {
    if (sanitized.error) {
      warnings.push({
        code: sanitized.error,
        message:
          "Nie udało się oczyścić metadanych obrazu. Użyjemy oryginalnego pliku, co może skutkować gorszą jakością.",
        severity: "warning",
      });
    }
  }

  const blob = sanitized.ok ? sanitized.blob : file;
  const checksum = await computeChecksum(blob).catch(() => null);
  if (!checksum) {
    warnings.push({
      code: "checksum_failure",
      message: "Nie udało się obliczyć sumy kontrolnej. Kontynuujemy bez niej.",
      severity: "warning",
    });
  }

  const previewUrl = URL.createObjectURL(blob);

  return {
    errors: [],
    payload: {
      sanitizedBlob: blob,
      checksum: checksum ?? crypto.randomUUID(),
      width,
      height,
      size: blob.size,
      mimeType: blob.type || file.type,
      previewUrl,
      warnings,
    },
  };
}

async function sendMultipartRequest(
  formData: FormData,
  accessToken: string,
  signal: AbortSignal,
  totalBytes: number,
  onProgress: (progress: UploadProgress) => void
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", PERSONA_UPLOAD_ENDPOINT);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    signal.addEventListener("abort", abortHandler, { once: true });

    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : totalBytes;
      const loaded = event.lengthComputable ? event.loaded : Math.min(event.loaded, total);
      const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;

      onProgress({
        stage: "uploading",
        loadedBytes: loaded,
        totalBytes: total,
        percentage,
      });
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", abortHandler);
      reject(new TypeError("Network error"));
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", abortHandler);
      const responseBody = xhr.response ?? xhr.responseText ?? null;
      const response = new Response(responseBody, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: buildHeaders(xhr.getAllResponseHeaders()),
      });
      resolve(response);
    };

    xhr.send(formData);
  });
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dimensions;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
    image.src = src;
  });
}

async function validateMagicNumber(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // JPEG signatures: FF D8 FF E0 / FF D8 FF E1
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

  return isJpeg || isPng;
}

async function sanitizeImage(
  file: File,
  width: number,
  height: number
): Promise<{ ok: true; blob: Blob } | { ok: false; error?: "encode_failure" }> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return { ok: false, error: "encode_failure" };
  }

  try {
    const bitmap = await createImageBitmap(file);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
  } catch (error) {
    console.warn("[usePersonaUploader] createImageBitmap failed, falling back to HTMLImageElement.", error);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      context.drawImage(image, 0, 0, width, height);
    } catch (loadError) {
      console.error("[usePersonaUploader] loadImage fallback failed.", loadError);
      URL.revokeObjectURL(objectUrl);
      return { ok: false, error: "encode_failure" };
    }
    URL.revokeObjectURL(objectUrl);
  }

  const mimeType = file.type || "image/jpeg";
  const quality = mimeType === "image/jpeg" ? 0.92 : undefined;

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) {
    return { ok: false, error: "encode_failure" };
  }

  return { ok: true, blob };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      type,
      quality
    );
  });
}

async function computeChecksum(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safeParseJson<T = unknown>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn("[usePersonaUploader] Failed to parse JSON response.", error);
    return undefined;
  }
}

async function buildEmptyPreparedFile(): Promise<PreparedFile> {
  return {
    sanitizedBlob: new Blob(),
    checksum: "",
    width: 0,
    height: 0,
    size: 0,
    mimeType: "application/octet-stream",
    previewUrl: "",
    warnings: [],
  };
}

function parseValidationErrors(
  status: number,
  body: Record<string, unknown> | undefined,
  constraints: UploadConstraints
): PersonaValidationError[] {
  const errorMessage = typeof body?.error === "string" ? body.error : "";
  const details = (body?.details ?? {}) as Record<string, unknown>;

  if (status === 413 || /too large/i.test(errorMessage)) {
    const maxBytes = typeof details?.maxBytes === "number" ? details.maxBytes : constraints.maxBytes;
    return [
      {
        code: "exceeds_max_size",
        message: `Plik jest zbyt duży. Maksymalny rozmiar to ${formatBytes(maxBytes)}.`,
      },
    ];
  }

  if (/unsupported mime/i.test(errorMessage)) {
    const allowed = Array.isArray(details?.allowedMimeTypes)
      ? (details.allowedMimeTypes as string[])
      : constraints.allowedMimeTypes;
    return [
      {
        code: "unsupported_mime",
        message: `Format pliku nie jest obsługiwany. Dozwolone: ${allowed
          .map((type) => type.replace("image/", "").toUpperCase())
          .join(", ")}.`,
      },
    ];
  }

  if (
    /resolution/i.test(errorMessage) ||
    (status === 400 &&
      typeof details?.minWidth === "number" &&
      typeof details?.minHeight === "number")
  ) {
    const minWidth = typeof details?.minWidth === "number" ? details.minWidth : constraints.minWidth;
    const minHeight = typeof details?.minHeight === "number" ? details.minHeight : constraints.minHeight;
    return [
      {
        code: "below_min_resolution",
        message: `Obraz ma zbyt małą rozdzielczość. Wymagane minimum to ${minWidth}×${minHeight}px.`,
        details,
      },
    ];
  }

  return [
    {
      code: "server_error",
      message:
        errorMessage || "Serwer odrzucił plik. Upewnij się, że spełnia wymagania dotyczące rozmiaru i formatu.",
    },
  ];
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = bytes;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
}

function buildHeaders(rawHeaders: string): Headers {
  const headers = new Headers();
  for (const line of rawHeaders.split("\r\n")) {
    if (!line) {
      continue;
    }

    const [name, ...rest] = line.split(":");
    if (!name || rest.length === 0) {
      continue;
    }

    headers.append(name.trim(), rest.join(":").trim());
  }
  return headers;
}

export const __testOnly = {
  formatBytes,
  parseValidationErrors: (
    status: number,
    body: Record<string, unknown> | undefined,
    constraints: UploadConstraints
  ) => parseValidationErrors(status, body, constraints),
};
