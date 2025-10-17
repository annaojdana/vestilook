import { useCallback, useEffect, useId, useMemo, useState, type FC } from "react";
import { InfoIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PersonaValidationError } from "@/types.ts";

import FileDropzone from "./FileDropzone.tsx";
import PersonaPreviewCard from "./PersonaPreviewCard.tsx";
import ValidationSummary from "./ValidationSummary.tsx";
import { usePersonaUploadContext } from "./PersonaUploadContext.tsx";

const PersonaUploader: FC = () => {
  const {
    state,
    consent,
    busy,
    selectFile,
    removeFile,
    upload,
    resetValidation,
    constraints,
  } = usePersonaUploadContext();

  const [transientErrors, setTransientErrors] = useState<PersonaValidationError[]>([]);
  const summaryId = useId();
  const helperId = useId();

  const displayedErrors = state.validationErrors.length > 0 ? state.validationErrors : transientErrors;

  useEffect(() => {
    if (state.validationErrors.length > 0) {
      setTransientErrors([]);
    }
  }, [state.validationErrors]);

  const handleFileAccepted = useCallback(
    async (file: File) => {
      setTransientErrors([]);
      await selectFile(file);
    },
    [selectFile]
  );

  const handleDropRejected = useCallback(
    (errors: PersonaValidationError[]) => {
      resetValidation();
      setTransientErrors(errors);
    },
    [resetValidation]
  );

  const handleUpload = useCallback(async () => {
    setTransientErrors([]);
    await upload();
  }, [upload]);

  const handleRemove = useCallback(() => {
    setTransientErrors([]);
    removeFile();
  }, [removeFile]);

  const statusLabel = useMemo(() => mapStatusToLabel(state.status), [state.status]);
  const statusAppearance = useMemo(() => mapStatusAppearance(state.status), [state.status]);

  const uploadDisabled = busy || !state.sanitizedBlob || !state.selectedFile;
  const removeDisabled = busy || (!state.selectedFile && state.preview.status === "empty");

  const helperText = consent.isCompliant
    ? "Po przesłaniu nowa persona zastąpi poprzednią wersję natychmiast po ukończeniu walidacji."
    : "Przed przesłaniem wymagamy aktualnej zgody na przetwarzanie wizerunku.";

  return (
    <section
      className="flex h-full flex-col gap-6 rounded-2xl border border-border/70 bg-card/80 p-6 shadow-inner"
      aria-describedby={helperId}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">Persona Bazowa</p>
          <h2 className="text-xl font-semibold text-foreground">Prześlij zdjęcie referencyjne</h2>
        </div>
        <Badge variant={statusAppearance.variant} className={statusAppearance.className}>
          {statusLabel}
        </Badge>
      </header>

      <p id={helperId} className="flex items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 text-muted-foreground/80" aria-hidden="true" />
        {helperText}
      </p>

      <FileDropzone busy={busy} onFileAccepted={handleFileAccepted} onRejected={handleDropRejected} />

      <PersonaPreviewCard
        preview={state.preview}
        loading={state.status === "validating" || state.status === "uploading"}
        onRemove={removeDisabled ? undefined : handleRemove}
        ariaDescribedBy={summaryId}
      />

      <ValidationSummary id={summaryId} errors={displayedErrors} />

      <footer className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatConstraints(constraints)}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={handleRemove}
            disabled={removeDisabled}
            className="justify-center text-sm text-muted-foreground hover:text-foreground sm:justify-start"
          >
            <XIcon className="mr-2 size-4" />
            Usuń plik
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploadDisabled}
            aria-busy={state.status === "uploading"}
            className="min-w-[10rem]"
          >
            {state.status === "uploading" ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Przesyłanie...
              </>
            ) : (
              <>
                <UploadCloudIcon className="mr-2 size-4" />
                Prześlij personę
              </>
            )}
          </Button>
        </div>
      </footer>
    </section>
  );
};

function mapStatusToLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Gotowe do przesłania";
    case "validating":
      return "Trwa walidacja";
    case "uploading":
      return "Przesyłanie";
    case "success":
      return "Zapisano";
    case "error":
      return "Wymagana uwaga";
    default:
      return "Oczekuje na plik";
  }
}

function mapStatusAppearance(
  status: string
): { variant: "default" | "secondary" | "destructive" | "outline"; className?: string } {
  switch (status) {
    case "ready":
      return { variant: "secondary" };
    case "validating":
    case "uploading":
      return { variant: "default" };
    case "success":
      return { variant: "secondary", className: "bg-emerald-500 text-emerald-50 hover:bg-emerald-500/90" };
    case "error":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

function formatConstraints(constraints: { allowedMimeTypes: string[]; maxBytes: number; minWidth: number; minHeight: number }) {
  const types = constraints.allowedMimeTypes.map((type) => type.replace("image/", "").toUpperCase()).join(" / ");
  return `Dozwolone formaty: ${types}, min. ${constraints.minWidth}×${constraints.minHeight}px, max ${formatBytes(
    constraints.maxBytes
  )}.`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return "–";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[index]}`;
}

export default PersonaUploader;
