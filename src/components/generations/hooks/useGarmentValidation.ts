import { useCallback, useMemo, useState } from "react";

import type { ImageValidationConstraints } from "@/types.ts";

import type { GarmentFileState, GarmentValidationError } from "../types.ts";

export interface UseGarmentValidationResult {
  validating: boolean;
  error: GarmentValidationError | null;
  validate: (files: FileList | null) => Promise<GarmentFileState | null>;
  resetError: () => void;
}

export function useGarmentValidation(constraints: ImageValidationConstraints): UseGarmentValidationResult {
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<GarmentValidationError | null>(null);

  const allowedMime = useMemo(() => new Set(constraints.allowedMimeTypes.map((value) => value.toLowerCase())), [constraints.allowedMimeTypes]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const validate = useCallback(
    async (files: FileList | null): Promise<GarmentFileState | null> => {
      if (!files || files.length === 0) {
        const validationError = createError("missing_file", "Dołącz zdjęcie ubrania, aby kontynuować.");
        setError(validationError);
        return null;
      }

      const file = files.item(0);
      if (!file) {
        const validationError = createError("missing_file", "Nie udało się odczytać pliku. Spróbuj ponownie.");
        setError(validationError);
        return null;
      }

      const mimeType = (file.type || "").toLowerCase();
      if (!mimeType || !allowedMime.has(mimeType)) {
        const readableTypes = Array.from(allowedMime.values())
          .map((type) => type.split("/").pop()?.toUpperCase() ?? type)
          .join(", ");
        const validationError = createError("unsupported_mime", `Obsługujemy tylko pliki ${readableTypes}.`, {
          mimeType: file.type,
        });
        setError(validationError);
        return null;
      }

      if (constraints.maxBytes > 0 && file.size > constraints.maxBytes) {
        const validationError = createError(
          "exceeds_max_size",
          `Plik ma rozmiar ${formatBytes(file.size)}, maksymalnie ${formatBytes(constraints.maxBytes)}.`,
          {
            size: file.size,
            maxBytes: constraints.maxBytes,
          }
        );
        setError(validationError);
        return null;
      }

      const previewUrl = URL.createObjectURL(file);
      setValidating(true);
      setError(null);

      try {
        const { width, height } = await loadImageDimensions(previewUrl);

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          const validationError = createError(
            "invalid_dimensions",
            "Nie udało się rozpoznać wymiarów obrazu. Spróbuj ponownie z innym plikiem.",
            { width, height }
          );
          setError(validationError);
          URL.revokeObjectURL(previewUrl);
          return null;
        }

        if (width < constraints.minWidth || height < constraints.minHeight) {
          const validationError = createError(
            "below_min_resolution",
            `Zdjęcie jest zbyt małe. Minimalna rozdzielczość to ${constraints.minWidth}×${constraints.minHeight} px.`,
            {
              width,
              height,
              minWidth: constraints.minWidth,
              minHeight: constraints.minHeight,
            }
          );
          setError(validationError);
          URL.revokeObjectURL(previewUrl);
          return null;
        }

        const result: GarmentFileState = {
          file,
          previewUrl,
          width,
          height,
        };

        setError(null);
        return result;
      } catch (unknownError) {
        const validationError = createError(
          "invalid_dimensions",
          "Nie udało się wczytać obrazu. Upewnij się, że plik nie jest uszkodzony.",
          {
            cause: unknownError instanceof Error ? unknownError.message : String(unknownError),
          }
        );
        setError(validationError);
        URL.revokeObjectURL(previewUrl);
        return null;
      } finally {
        setValidating(false);
      }
    },
    [allowedMime, constraints.maxBytes, constraints.minHeight, constraints.minWidth]
  );

  return {
    validating,
    error,
    validate,
    resetError,
  };
}

function createError(
  code: GarmentValidationError["code"],
  message: string,
  details?: Record<string, unknown>
): GarmentValidationError {
  return { code, message, details };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => {
      reject(new Error("Failed to load image metadata."));
    };
    image.src = src;
  });
}
