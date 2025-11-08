import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type FC,
} from "react";
import { UploadCloudIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PersonaValidationError } from "@/types.ts";

interface FileDropzoneProps {
  busy: boolean;
  onFileAccepted: (file: File) => Promise<void> | void;
  onRejected: (errors: PersonaValidationError[]) => void;
}

const ACCEPT_MIME = "image/png,image/jpeg";

const FileDropzone: FC<FileDropzoneProps> = ({ busy, onFileAccepted, onRejected }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const instructionsId = useId();
  const helperId = useId();

  const resetInput = () => {
    const input = inputRef.current;
    if (input) {
      input.value = "";
    }
  };

  const createError = useCallback(
    (code: PersonaValidationError["code"], message: string): PersonaValidationError => ({
      code,
      message,
    }),
    []
  );

  const emitErrors = useCallback(
    (errors: PersonaValidationError[]) => {
      if (errors.length === 0) {
        return;
      }
      onRejected(errors);
    },
    [onRejected]
  );

  const pickFirstFile = (files: FileList | File[] | null): File | null => {
    if (!files || files.length === 0) {
      return null;
    }

    const list = Array.isArray(files) ? files : Array.from(files);
    return list.find((file) => file instanceof File && file.size > 0) ?? list[0] ?? null;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (busy) {
        return;
      }

      const file = pickFirstFile(files);
      if (!file) {
        emitErrors([createError("missing_file", "Nie znaleziono pliku do przesłania.")]);
        return;
      }

      resetInput();
      await onFileAccepted(file);
    },
    [busy, createError, emitErrors, onFileAccepted]
  );

  const handleInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      await handleFiles(files);
    },
    [handleFiles]
  );

  const handleOpenFileDialog = useCallback(() => {
    if (busy) {
      return;
    }

    inputRef.current?.click();
  }, [busy]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpenFileDialog();
      }
    },
    [handleOpenFileDialog]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (busy) {
        return;
      }

      event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    },
    [busy]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (busy) {
        return;
      }

      setIsDragging(false);
      const { dataTransfer } = event;
      if (!dataTransfer) {
        emitErrors([createError("missing_file", "Nie rozpoznano przesłanego pliku.")]);
        return;
      }

      const items = Array.from(dataTransfer.items ?? []);
      const hasUriItem = items.some((item) => item.kind === "string" && item.type === "text/uri-list");
      if (hasUriItem) {
        emitErrors([
          createError(
            "unsupported_mime",
            "Upuszczony element jest odnośnikiem. Przeciągnij bezpośrednio plik JPEG lub PNG."
          ),
        ]);
        return;
      }

      if (items.length > 0) {
        const file = items.find((item) => item.kind === "file")?.getAsFile();
        if (file) {
          resetInput();
          await onFileAccepted(file);
          return;
        }
      }

      await handleFiles(dataTransfer.files);
    },
    [busy, createError, emitErrors, handleFiles, onFileAccepted]
  );

  return (
    <div
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={busy}
      aria-label="Dodaj zdjęcie persony"
      aria-describedby={`${instructionsId} ${helperId}`}
      onClick={handleOpenFileDialog}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/40 px-6 py-10 text-center transition",
        busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary hover:bg-primary/5",
        isDragging ? "border-primary bg-primary/10" : null
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_MIME}
        tabIndex={-1}
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
      />
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadCloudIcon className="size-7" aria-hidden="true" />
      </div>
      <div id={instructionsId} className="space-y-1 text-sm">
        <p className="font-medium text-foreground">Przeciągnij i upuść plik JPEG lub PNG</p>
        <p className="text-muted-foreground">lub użyj przycisku poniżej, aby wskazać plik z dysku.</p>
      </div>
      <p id={helperId} className="text-xs text-muted-foreground/80">
        Minimalna rozdzielczość {">="} 1024×1024. Upewnij się, że twarz i sylwetka są w pełni widoczne.
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          handleOpenFileDialog();
        }}
        className="mt-3 w-full min-h-11 sm:w-auto"
      >
        Wybierz plik z urządzenia
      </Button>
    </div>
  );
};

export default FileDropzone;
