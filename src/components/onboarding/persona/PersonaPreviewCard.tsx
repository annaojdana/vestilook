import { memo, useMemo, type FC } from "react";
import { ImageIcon, Loader2Icon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { PersonaPreviewModel } from "@/types.ts";

interface PersonaPreviewCardProps {
  preview: PersonaPreviewModel;
  loading: boolean;
  onRemove?: () => void;
  ariaDescribedBy?: string;
}

const PersonaPreviewCard: FC<PersonaPreviewCardProps> = ({ preview, loading, onRemove, ariaDescribedBy }) => {
  if (!preview || preview.status === "empty" || !preview.src) {
    return <EmptyPreview ariaDescribedBy={ariaDescribedBy} />;
  }

  const metaEntries = useMemo(() => buildMetadataEntries(preview), [preview]);
  const statusAppearance = resolveStatusAppearance(preview.status);

  return (
    <figure
      className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm"
      aria-describedby={ariaDescribedBy}
    >
      <img
        src={preview.src}
        alt={preview.alt}
        className="h-64 w-full object-cover object-center"
        loading="lazy"
        width={preview.width ?? undefined}
        height={preview.height ?? undefined}
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-4 pb-4 pt-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusAppearance.variant} className={statusAppearance.className}>
              {statusAppearance.label}
            </Badge>
            {preview.updatedAt ? (
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Aktualizacja: {formatTimestamp(preview.updatedAt)}
              </span>
            ) : null}
          </div>
          {onRemove ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 px-2 text-xs">
              <Trash2Icon className="mr-1.5 size-3.5" />
              Usuń
            </Button>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {metaEntries.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-0.5">
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground/60">{entry.label}</dt>
              <dd className="text-foreground/90">{entry.value}</dd>
            </div>
          ))}
        </dl>
        {preview.errorMessage ? (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {preview.errorMessage}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-sm">
          <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Trwa przetwarzanie persony...</span>
        </div>
      ) : null}
    </figure>
  );
};

const EmptyPreview: FC<{ ariaDescribedBy?: string }> = memo(({ ariaDescribedBy }) => {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-muted/20 text-center"
      aria-describedby={ariaDescribedBy}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ImageIcon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Podgląd persony pojawi się po wyborze pliku.</p>
        <p className="text-xs text-muted-foreground/80">
          Rekomendujemy zdjęcie na neutralnym tle, z równomiernym oświetleniem i sylwetką en face.
        </p>
      </div>
    </div>
  );
});
EmptyPreview.displayName = "EmptyPreview";

export default PersonaPreviewCard;

function buildMetadataEntries(preview: PersonaPreviewModel): Array<{ label: string; value: string }> {
  return [
    {
      label: "Rozdzielczość",
      value:
        preview.width && preview.height ? `${preview.width}×${preview.height} px` : "Nieznana",
    },
    {
      label: "Format",
      value: preview.contentType ?? "–",
    },
    {
      label: "Rozmiar",
      value: formatBytes(preview.sizeBytes ?? null),
    },
    {
      label: "Checksum",
      value: preview.checksum ? truncateChecksum(preview.checksum) : "–",
    },
  ];
}

function resolveStatusAppearance(
  status: PersonaPreviewModel["status"]
): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string } {
  switch (status) {
    case "ready":
      return { label: "Gotowe", variant: "secondary" };
    case "uploading":
      return { label: "Przesyłanie", variant: "default" };
    case "error":
      return { label: "Błąd", variant: "destructive" };
    default:
      return { label: "Podgląd", variant: "outline" };
  }
}

function truncateChecksum(checksum: string): string {
  if (checksum.length <= 12) {
    return checksum;
  }

  return `${checksum.slice(0, 6)}…${checksum.slice(-4)}`;
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes || !Number.isFinite(bytes)) {
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
