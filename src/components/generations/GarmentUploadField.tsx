import { useId } from "react";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ImageValidationConstraints } from "@/types.ts";

import type { GarmentFileState, GarmentValidationError } from "./types.ts";

export interface GarmentUploadFieldProps {
  value: GarmentFileState | null;
  error: GarmentValidationError | null;
  validating: boolean;
  constraints: ImageValidationConstraints;
  onFileSelect: (files: FileList | null) => void;
  onClear: () => void;
}

export function GarmentUploadField({
  value,
  error,
  validating,
  constraints,
  onFileSelect,
  onClear,
}: GarmentUploadFieldProps) {
  const inputId = useId();
  const accept = constraints.allowedMimeTypes.join(",");

  return (
    <Card className="border-dashed border-muted-foreground/20 bg-background" data-testid="garment-upload-card">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Zdjęcie ubrania</CardTitle>
            <CardDescription>
              Dodaj zdjęcie ubrania, które chcesz zwizualizować na swojej personie. Upewnij się, że materiał
              jest dobrze oświetlony i widoczny w całości.
            </CardDescription>
          </div>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              aria-label="Usuń wybrany plik"
              data-testid="garment-upload-clear"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Wyczyść
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label htmlFor={inputId} className="mb-2 block text-sm font-medium text-foreground">
            Wybierz plik
          </Label>
          <Input
            id={inputId}
            type="file"
            accept={accept}
            onChange={(event) => onFileSelect(event.currentTarget.files)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : `${inputId}-help`}
            data-testid="garment-upload-input"
          />
          <p id={`${inputId}-help`} className="mt-2 text-xs text-muted-foreground">
            Obsługiwane formaty: {constraints.allowedMimeTypes.join(", ")}. Minimalna rozdzielczość:{" "}
            {constraints.minWidth}×{constraints.minHeight} px. Maksymalny rozmiar: {formatBytes(constraints.maxBytes)}.
          </p>
        </div>

        {value ? (
          <figure
            className="relative overflow-hidden rounded-xl border border-muted-foreground/20 bg-muted/30"
            data-testid="garment-preview"
          >
            <img
              src={value.previewUrl}
              alt="Podgląd wybranego ubrania"
              className="aspect-square w-full object-cover object-center sm:aspect-[4/3]"
            />
            <figcaption className="flex items-center justify-between gap-3 border-t border-muted-foreground/10 bg-background/80 px-4 py-2 text-xs text-muted-foreground">
              <span>
                {value.file.name} • {value.width}×{value.height}px • {formatBytes(value.file.size)}
              </span>
            </figcaption>
          </figure>
        ) : (
          <div
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground"
            data-testid="garment-placeholder"
          >
            {validating ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImageIcon className="size-5" aria-hidden="true" />}
            <p>Brak wybranego pliku. Dodaj zdjęcie, aby zobaczyć podgląd.</p>
          </div>
        )}

        {error ? (
          <Alert id={`${inputId}-error`} variant="destructive" data-testid="garment-error-alert">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
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

  const precision = value >= 10 || value % 1 === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
